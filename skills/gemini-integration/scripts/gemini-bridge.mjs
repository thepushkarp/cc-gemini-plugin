#!/usr/bin/env node

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const FORMATS = new Set(["text", "json", "stream-json"]);
const MAX_FRAME_BYTES = 32 * 1024 * 1024;
const MAX_PARTIAL_BYTES = 32 * 1024 * 1024;
const DIAGNOSTIC_TAIL_LENGTH = 8192;

const USAGE = `Usage:
  node gemini-bridge.mjs [options] <task>

Reads and edits files as the task requires; commands use agy's configured permissions.

Options:
  --model <name>               Model override; discover models with agy models.
  --effort <value>             Reasoning effort override, validated by agy.
  --conversation <id>          Resume this specific conversation.
  --cwd <path>                Workspace directory. Default: caller's directory.
  --format <text|json|stream-json>
                              Bridge output format. Default: text.
  --timeout <seconds>          Positive time limit. Default: 600.
  --sandbox                   Enable agy's native terminal sandbox.
  --print-command             Print a JSON launch description without running.
  --                          Treat remaining arguments as task text.
  -h, --help                  Show this help.
`;

function optionValue(argv, index) {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw new Error(`Missing value for ${argv[index]}. Use --help for usage.`);
  }
  return value;
}

function parseCliArgs(argv) {
  const options = {
    task: "", model: undefined, effort: undefined, conversation: undefined,
    cwd: process.cwd(), format: "text",
    timeout: 600, sandbox: false, printCommand: false, help: false,
  };
  const taskTokens = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      taskTokens.push(...argv.slice(index + 1));
      break;
    }
    if (token === "--help" || token === "-h") {
      options.help = true;
    } else if (token === "--sandbox") {
      options.sandbox = true;
    } else if (token === "--print-command") {
      options.printCommand = true;
    } else if (["--model", "--effort", "--conversation", "--cwd", "--format", "--timeout"].includes(token)) {
      const value = optionValue(argv, index);
      index += 1;
      const key = token.slice(2);
      if (key === "timeout") {
        const seconds = Number(value);
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(seconds) || seconds <= 0 || seconds * 1000 > Number.MAX_SAFE_INTEGER) {
          throw new Error(`--timeout must be positive seconds. Received: ${value}`);
        }
        options.timeout = seconds;
      } else {
        options[key] = value;
      }
    } else if (token.startsWith("-")) {
      throw new Error(`Unknown option ${token}. Use --help for supported options, or -- before task text beginning with a dash.`);
    } else {
      taskTokens.push(token);
    }
  }
  options.task = taskTokens.join(" ");
  if (!FORMATS.has(options.format)) throw new Error(`Unsupported --format ${options.format}. Expected text, json, or stream-json.`);
  if (!options.help && !options.task.trim()) throw new Error("A task is required. Use --help for usage.");
  options.cwd = path.resolve(options.cwd);
  return options;
}

function buildLaunchDescription(options) {
  const args = ["--input-format", "stream-json", "--output-format", "stream-json", "--disable-slash-commands", "--mode", "accept-edits", "--print-timeout", `${options.timeout.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 })}s`];
  for (const key of ["model", "effort", "conversation"]) {
    if (options[key] !== undefined) args.push(`--${key}`, options[key]);
  }
  if (options.sandbox) args.push("--sandbox");
  return {
    command: process.platform === "win32" ? "agy.exe" : "agy",
    args,
    cwd: options.cwd,
    input: JSON.stringify({ event: "user", message: { content: options.task } }) + "\n",
  };
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resultFailure(result) {
  if (!object(result) || typeof result.status !== "string" || typeof result.response !== "string") {
    return "agy returned a malformed result: expected status and response strings.";
  }
  if (result.denied_actions !== undefined && !Array.isArray(result.denied_actions)) {
    return "agy returned malformed denied_actions; expected an array.";
  }
  if (result.denied_actions?.length) {
    return `agy denied ${result.denied_actions.length} requested action(s). The task is incomplete; review result.denied_actions and configured permissions.`;
  }
  if (result.status !== "SUCCESS") {
    return `agy finished with status ${result.status}${result.error ? `: ${String(result.error)}` : "."}`;
  }
  if (!result.response.trim()) return "agy returned an empty response. No usable task result was produced.";
  return null;
}

async function write(sink, text) {
  if (!text) return;
  if (sink.write(text) === false && typeof sink.once === "function") {
    await new Promise((resolve, reject) => {
      const done = () => { sink.removeListener("error", failed); resolve(); };
      const failed = (error) => { sink.removeListener("drain", done); reject(error); };
      sink.once("drain", done);
      sink.once("error", failed);
    });
  }
}

async function runChild(launch, options, { spawnImpl, stdout, stderr, signal }) {
  if (signal?.aborted) return { result: null, error: "agy cancelled before launch.", partial: "" };
  let child;
  try {
    child = spawnImpl(launch.command, launch.args, {
      cwd: launch.cwd, env: process.env, shell: false, windowsHide: true,
      detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    return { result: null, error: launchFailure(error, launch.command), partial: "" };
  }

  let failure = null;
  let result = null;
  let seenResult = false;
  let partial = "";
  let partialBytes = 0;
  let diagnosticTail = "";
  let closed = false;
  let stopping = false;
  let forceTimer;
  let timeoutTimer;
  const cleanupAttempts = [];
  const fail = (message) => { failure ??= message; };
  const cleanupError = (error) => {
    if (error.code !== "ESRCH") {
      failure = `${failure ? `${failure}\n` : ""}Unable to terminate the agy process tree: ${error.message}`;
    }
  };
  function killTree(force) {
    if (process.platform === "win32" && child.pid) {
      // Kill the tree in one operation: once its parent exits, taskkill cannot
      // discover orphaned commands. Windows has no POSIX process-group signal.
      cleanupAttempts.push(new Promise((resolve) => {
        const killer = spawn(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
        killer.once("error", (error) => { cleanupError(error); child.kill("SIGKILL"); resolve(); });
        killer.once("close", (code) => {
          if (code !== 0 && !closed) {
            cleanupError(new Error(`taskkill exited with code ${code}; delegated commands may still be running.`));
            child.kill("SIGKILL");
          }
          resolve();
        });
      }));
    } else {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
        else child.kill(force ? "SIGKILL" : "SIGTERM");
      } catch (error) {
        cleanupError(error);
      }
    }
  }
  function stop(message) {
    fail(message);
    if (closed || stopping) return;
    stopping = true;
    killTree(false);
    forceTimer = setTimeout(() => killTree(true), 1000);
  }
  const cancelled = () => stop("agy cancelled. Partial edits may exist; inspect the workspace before retrying.");
  if (signal) signal.addEventListener("abort", cancelled, { once: true });
  else {
    process.once("SIGINT", cancelled);
    process.once("SIGTERM", cancelled);
  }
  // Node timers have a 32-bit delay limit; long requested deadlines are rearmed.
  const deadline = Date.now() + options.timeout * 1000;
  function armTimeout() {
    const remaining = deadline - Date.now();
    if (remaining <= 0) stop(`agy timed out after ${options.timeout} seconds. Partial edits may exist; inspect the workspace before retrying.`);
    else timeoutTimer = setTimeout(armTimeout, Math.min(remaining, 2_147_483_647));
  }
  armTimeout();

  const completion = new Promise((resolve) => {
    child.once("error", (error) => fail(launchFailure(error, launch.command)));
    child.once("close", (code, exitSignal) => {
      closed = true;
      resolve({ code, exitSignal });
    });
  });
  child.stdin.once("error", (error) => stop(`Cannot send task to agy: ${error.message}`));

  async function consumeStdout() {
    child.stdout.setEncoding("utf8");
    let pending = "";
    async function consumeLine(line) {
      if (!line.trim()) return;
      if (Buffer.byteLength(line) > MAX_FRAME_BYTES) throw new Error("agy output event exceeds the 32 MiB framing limit; output was not truncated.");
      let event;
      try { event = JSON.parse(line); }
      catch { throw new Error("agy emitted malformed stream-json output; expected one JSON event per line."); }
      if (!object(event) || typeof event.event !== "string") throw new Error("agy emitted a malformed stream event: missing event name.");
      if (event.event === "result") {
        if (seenResult) throw new Error("agy emitted duplicate terminal results for one task.");
        seenResult = true;
        if (!object(event.result)) throw new Error("agy emitted a malformed terminal result; expected a result object.");
        result = event.result;
      } else {
        const step = event.step_update;
        if (event.event === "step_update" && step?.step_type === "agent_response" && typeof step.text_delta === "string") {
          partialBytes += Buffer.byteLength(step.text_delta);
          if (partialBytes > MAX_PARTIAL_BYTES) throw new Error("agy partial response exceeds the 32 MiB limit; the run was stopped instead of silently truncating output.");
          partial += step.text_delta;
        }
        if (options.format === "stream-json") await write(stdout, JSON.stringify(event) + "\n");
      }
    }
    try {
      for await (const chunk of child.stdout) {
        pending += chunk;
        let newline;
        while ((newline = pending.indexOf("\n")) !== -1) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          await consumeLine(line);
        }
        if (Buffer.byteLength(pending) > MAX_FRAME_BYTES) throw new Error("agy output event exceeds the 32 MiB framing limit; output was not truncated.");
      }
      await consumeLine(pending);
    } catch (error) {
      stop(error.message);
    }
  }
  async function consumeStderr() {
    child.stderr.setEncoding("utf8");
    try {
      for await (const chunk of child.stderr) {
        diagnosticTail = (diagnosticTail + chunk).slice(-DIAGNOSTIC_TAIL_LENGTH);
        await write(stderr, chunk);
      }
    } catch (error) {
      stop(`Cannot read agy diagnostics: ${error.message}`);
    }
  }

  const readers = [consumeStdout(), consumeStderr()];
  try {
    if (signal?.aborted) cancelled();
    else {
      try { child.stdin.end(launch.input); }
      catch (error) { stop(`Cannot send task to agy: ${error.message}`); }
    }
    const outcome = await completion;
    await Promise.all(readers);
    // Descendants can close their pipes before the process-group leader exits.
    // Escalate any survivors even if close arrived before the grace timer.
    if (stopping && process.platform !== "win32") killTree(true);
    clearTimeout(forceTimer);
    await Promise.all(cleanupAttempts);
    if (outcome.code !== 0) fail(`agy exited ${outcome.exitSignal ? `on signal ${outcome.exitSignal}` : `with code ${outcome.code ?? "unknown"}`}.`);
    if (!failure) failure = seenResult ? resultFailure(result) : "agy exited without a terminal result. No completed response was produced.";
    if (failure && diagnosticTail.trim()) failure += `\nagy diagnostics (last ${DIAGNOSTIC_TAIL_LENGTH} characters):\n${diagnosticTail.trim()}`;
    return { result, error: failure, partial };
  } finally {
    clearTimeout(timeoutTimer);
    clearTimeout(forceTimer);
    if (signal) signal.removeEventListener("abort", cancelled);
    else {
      process.removeListener("SIGINT", cancelled);
      process.removeListener("SIGTERM", cancelled);
    }
  }
}

function launchFailure(error, command) {
  return error.code === "ENOENT"
    ? `Cannot launch ${command}: Antigravity CLI is not installed or not on PATH. Install it from https://antigravity.google/docs/cli/install/ and authenticate with agy.`
    : `Cannot launch ${command}: ${error.message}`;
}

function requestedFormat(argv) {
  let format = "text";
  for (let index = 0; index < argv.length && argv[index] !== "--"; index += 1) {
    if (argv[index] === "--format" && FORMATS.has(argv[index + 1])) format = argv[++index];
  }
  return format;
}

export async function main(argv = process.argv.slice(2), { spawnImpl = spawn, stdout = process.stdout, stderr = process.stderr, signal } = {}) {
  let format = requestedFormat(argv);
  let outcome;
  try {
    const options = parseCliArgs(argv);
    format = options.format;
    if (options.help) { await write(stdout, USAGE); return 0; }
    let workspace;
    try { workspace = await stat(options.cwd); }
    catch (error) { throw new Error(`Cannot access workspace ${options.cwd}: ${error.message}`); }
    if (!workspace.isDirectory()) throw new Error(`Workspace is not a directory: ${options.cwd}`);
    const launch = buildLaunchDescription(options);
    if (options.printCommand) { await write(stdout, JSON.stringify(launch, null, 2) + "\n"); return 0; }
    outcome = await runChild(launch, options, { spawnImpl, stdout, stderr, signal });
  } catch (error) {
    outcome = { result: null, error: error.message, partial: "" };
  }
  const { result, partial } = outcome;
  let error = outcome.error;
  const nativeResponse = typeof result?.response === "string" ? result.response : "";
  if (!nativeResponse.trim() && partial && format === "json") error += `\nPartial response (task did not complete):\n${partial}`;
  const envelope = { ok: error === null, result, error };
  if (format === "json") await write(stdout, JSON.stringify(envelope) + "\n");
  else if (format === "stream-json") await write(stdout, JSON.stringify({ event: "result", ...envelope }) + "\n");
  else {
    const response = nativeResponse.trim() ? nativeResponse : partial;
    if (response) await write(stdout, response + (response.endsWith("\n") ? "" : "\n"));
    if (error) await write(stderr, error + "\n");
  }
  return envelope.ok ? 0 : 1;
}

function isMainModule(moduleUrl) {
  if (!process.argv[1]) return false;
  try { return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1]); }
  catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = await main();
