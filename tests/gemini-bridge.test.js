import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { main } from "../skills/gemini-integration/scripts/gemini-bridge.mjs";

const fixture = fileURLToPath(new URL("./fixtures/fake-agy.mjs", import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "gemini bridge 测试 "));

async function run(args, scenario = "success", extras = {}) {
  let stdout = "";
  let stderr = "";
  let launch;
  let child;
  const exitCode = await main(args, {
    stdout: { write: (chunk) => { stdout += chunk; } },
    stderr: { write: (chunk) => { stderr += chunk; } },
    spawnImpl(command, argv, options) {
      launch = { command, argv, options };
      child = spawn(process.execPath, [fixture, ...argv], {
        ...options,
        env: { ...process.env, ...options.env, AGY_TEST_SCENARIO: scenario },
      });
      extras.onSpawn?.(child);
      return child;
    },
    ...(extras.signal ? { signal: extras.signal } : {}),
  });
  return { exitCode, stdout, stderr, launch, child };
}

test("transport sends a large literal task in one stdin message and uses the requested workspace", async () => {
  const task = `Analyze 'quotes' \"double quotes\" $HOME $(echo nope) ; | & \\ 中文\n${"context ".repeat(40_000)}`;
  const cwd = await fs.mkdtemp(path.join(scratch, "target workspace "));
  const result = await run(["--cwd", cwd, "--format", "json", "--task", task], "echo");
  assert.equal(result.exitCode, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.error, null);
  const observed = JSON.parse(envelope.result.response);
  assert.equal(await fs.realpath(observed.cwd), await fs.realpath(cwd));
  const messages = observed.input.trimEnd().split("\n").map(JSON.parse);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].event, "user");
  assert.ok(messages[0].message.content.includes(task));
  assert.equal(observed.eof, true);
  assert.ok(observed.args.includes("--disable-slash-commands"));
  for (const flag of ["--input-format", "--output-format"]) {
    assert.equal(observed.args[observed.args.indexOf(flag) + 1], "stream-json");
  }
  assert.equal(observed.args[observed.args.indexOf("--mode") + 1], "accept-edits");
  for (const flag of ["--model", "--effort", "--sandbox", "--continue", "--dangerously-skip-permissions"]) {
    assert.ok(!observed.args.includes(flag), flag);
  }
  assert.ok(!observed.args.some((arg) => arg.includes("context ")));
  assert.equal(result.launch.command, process.platform === "win32" ? "agy.exe" : "agy");
  assert.equal(result.launch.options.shell, false);
});

test("execution forwards model, effort, conversation, sandbox, and timeout without rewriting opaque values", async () => {
  const result = await run([
    "--format", "json", "--model", "future/model:experimental",
    "--effort", "future-effort", "--conversation", "opaque:session/value",
    "--sandbox", "--timeout", "17", "Implement", "the", "task",
  ], "echo");
  assert.equal(result.exitCode, 0, result.stderr);
  const { args } = JSON.parse(JSON.parse(result.stdout).result.response);
  for (const [flag, value] of [
    ["--model", "future/model:experimental"],
    ["--effort", "future-effort"], ["--conversation", "opaque:session/value"],
    ["--print-timeout", "17s"],
  ]) assert.equal(args[args.indexOf(flag) + 1], value, flag);
  assert.ok(args.includes("--sandbox"));
  assert.ok(!args.includes("--dangerously-skip-permissions"));
});

test("print-command resolves launch details without starting agy or ingesting focus files", async () => {
  const focusFile = path.join(scratch, "data with spaces.bin");
  await fs.writeFile(focusFile, "PRIVATE_CONTENT_NOT_FOR_INLINE_PROMPT");
  const result = await run([
    "--print-command", "--cwd", scratch, "--dirs", "src,lib",
    "--files", focusFile, "--", "--literal-task",
  ]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.launch, undefined);
  const launch = JSON.parse(result.stdout);
  assert.equal(launch.cwd, scratch);
  assert.equal(launch.args[launch.args.indexOf("--print-timeout") + 1], "600s");
  const prompt = JSON.parse(launch.input).message.content;
  for (const hint of ["src", "lib", "--literal-task"]) assert.ok(prompt.includes(hint));
  assert.ok(prompt.includes(JSON.stringify(focusFile).slice(1, -1)));
  assert.ok(!prompt.includes("PRIVATE_CONTENT_NOT_FOR_INLINE_PROMPT"));
});

test("invalid and retired options fail before launching with actionable diagnostics", async (t) => {
  for (const args of [
    ["--max-files", "3"], ["--max-file-bytes", "64"], ["--unknown"],
    ["--format", "xml"], ["--timeout", "0"],
    ["--timeout", "NaN"], ["--model"],
  ]) {
    await t.test(args.join(" "), async () => {
      const result = await run(args);
      assert.notEqual(result.exitCode, 0);
      assert.equal(result.launch, undefined);
      assert.ok(`${result.stdout}${result.stderr}`.includes(args[0]));
    });
  }
});

test("text and JSON retain native results, including after a recovered tool error", async () => {
  const textResult = await run(["inspect"]);
  assert.equal(textResult.exitCode, 0, textResult.stderr);
  assert.equal(textResult.stdout, "The analysis.\n");
  const jsonResult = await run(["--format", "json", "inspect"], "recovered-tool-error");
  const envelope = JSON.parse(jsonResult.stdout);
  assert.equal(jsonResult.exitCode, 0, jsonResult.stderr);
  assert.deepEqual(envelope, {
    ok: true,
    result: {
      status: "SUCCESS", response: "The analysis.\n", conversation_id: "conversation-opaque",
      usage: { input_tokens: 3, output_tokens: 5 }, denied_actions: [],
    },
    error: null,
  });
});

test("streaming forwards progress before completion and emits exactly one terminal event", async () => {
  let output = "";
  let progressBeforeExit = false;
  let child;
  const code = await main(["--format", "stream-json", "--timeout", "5", "inspect"], {
    stdout: { write(chunk) {
      output += chunk;
      if (String(chunk).includes('"event":"step_update"')) {
        progressBeforeExit = child.exitCode === null;
        child.send("progress-received");
      }
    } },
    stderr: { write() {} },
    spawnImpl(_command, args, options) {
      child = spawn(process.execPath, [fixture, ...args], {
        ...options, stdio: [...options.stdio, "ipc"],
        env: { ...process.env, AGY_TEST_SCENARIO: "await-progress" },
      });
      return child;
    },
  });
  assert.equal(code, 0);
  assert.equal(progressBeforeExit, true);
  const events = output.trimEnd().split("\n").map(JSON.parse);
  assert.ok(events.some((event) => event.event === "init"));
  assert.ok(events.some((event) => event.event === "future_progress" && event.detail === "preserve me"));
  assert.equal(events.filter((event) => event.event === "result").length, 1);
  assert.equal(events.at(-1).event, "result");
  assert.equal(events.at(-1).ok, true);
  assert.equal(events.at(-1).error, null);

  const failure = await run(["--format", "stream-json", "inspect"], "denied");
  const terminal = failure.stdout.trimEnd().split("\n").map(JSON.parse).filter((event) => event.event === "result");
  assert.notEqual(failure.exitCode, 0);
  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].ok, false);
  assert.equal(terminal[0].result.denied_actions.length, 1);
});

test("denied actions, unusable results and CLI failures cannot look successful", async (t) => {
  for (const [scenario, expected] of [
    ["denied", /denied|permission/i], ["empty", /empty|response/i],
    ["whitespace", /empty|response/i], ["failed-result", /status|fail|error/i],
    ["malformed", /JSON|parse|invalid|malformed/i], ["malformed-result", /malformed|response/i],
    ["missing", /result|missing/i],
    ["duplicate", /duplicate|multiple|result/i], ["nonzero", /23|exit|process/i],
  ]) {
    await t.test(scenario, async () => {
      const result = await run(["--format", "json", "inspect"], scenario);
      assert.notEqual(result.exitCode, 0);
      const envelope = JSON.parse(result.stdout);
      assert.equal(envelope.ok, false);
      assert.match(envelope.error, expected);
      if (["denied", "nonzero", "duplicate"].includes(scenario)) assert.equal(envelope.result.response, "The analysis.\n");
      if (scenario === "nonzero") assert.match(result.stderr, /IneligibleTierError/);
      if (["empty", "missing"].includes(scenario)) {
        assert.match(envelope.error, /Partial response[\s\S]*The analysis\./);
        assert.equal(envelope.result?.response ?? null, scenario === "empty" ? "" : null);
      }
    });
  }
});

test("partial response stays on stdout while text failures go to stderr", async () => {
  for (const scenario of ["denied", "empty", "missing"]) {
    const result = await run(["inspect"], scenario);
    assert.notEqual(result.exitCode, 0);
    assert.equal(result.stdout, "The analysis.\n");
    assert.match(result.stderr, /denied|response|result/i);
  }
});

test("timeout and cancellation terminate a running CLI and emit a failed result", async (t) => {
  await t.test("parent watchdog", async () => {
    const result = await run(["--format", "json", "--timeout", "0.15", "inspect"], "hang");
    assert.notEqual(result.exitCode, 0);
    assert.match(JSON.parse(result.stdout).error, /time|deadline/i);
    assert.ok(result.child.exitCode !== null || result.child.signalCode !== null);
  });
  await t.test("caller cancellation", async () => {
    const controller = new AbortController();
    const result = await run(["--format", "json", "inspect"], "hang", {
      signal: controller.signal,
      onSpawn(child) { child.once("spawn", () => controller.abort()); },
    });
    assert.notEqual(result.exitCode, 0);
    assert.match(JSON.parse(result.stdout).error, /cancel|abort|signal/i);
    assert.ok(result.child.exitCode !== null || result.child.signalCode !== null);
  });
});

test("cancellation stops delegated children that ignore TERM and do not hold CLI output open", { skip: process.platform === "win32" }, async () => {
  const controller = new AbortController();
  let delegatedPid;
  let output = "";
  try {
    const code = await main(["--format", "stream-json", "--timeout", "5", "inspect"], {
      signal: controller.signal,
      stdout: { write(chunk) {
        output += chunk;
        const event = JSON.parse(String(chunk));
        if (event.event === "delegated_child") {
          delegatedPid = event.pid;
          controller.abort();
        }
      } },
      stderr: { write() {} },
      spawnImpl(_command, args, options) {
        return spawn(process.execPath, [fixture, ...args], {
          ...options, env: { ...process.env, AGY_TEST_SCENARIO: "delegated-child" },
        });
      },
    });
    assert.ok(delegatedPid, output);
    assert.notEqual(code, 0);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        process.kill(delegatedPid, 0);
        if (process.platform === "linux") {
          const stat = await fs.readFile(`/proc/${delegatedPid}/stat`, "utf8");
          // Unreaped zombies still have a PID but cannot execute commands.
          if (stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z ")) return;
        }
      } catch (error) {
        if (error.code === "ESRCH" || error.code === "ENOENT") return;
        throw error;
      }
      await delay(20);
    }
    assert.fail(`Delegated process ${delegatedPid} survived cancellation`);
  } finally {
    if (delegatedPid) {
      try { process.kill(delegatedPid, "SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  }
});

test("an unavailable executable fails with an actionable installation error", async () => {
  let stdout = "";
  const code = await main(["--format", "json", "inspect"], {
    stdout: { write: (chunk) => { stdout += chunk; } }, stderr: { write() {} },
    spawnImpl(_command, args, options) {
      return spawn(path.join(scratch, "nonexistent-agy-executable"), args, options);
    },
  });
  assert.notEqual(code, 0);
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /agy/i);
  assert.match(envelope.error, /ENOENT|install|not found/i);
});

test("standalone copies, directory symlinks and the public launcher run from another workspace", async () => {
  const skillDir = fileURLToPath(new URL("../skills/gemini-integration", import.meta.url));
  const copiedSkill = path.join(scratch, "independent skill copy");
  await fs.cp(skillDir, copiedSkill, { recursive: true });
  const linkedSkill = path.join(scratch, "linked skill");
  await fs.symlink(copiedSkill, linkedSkill, process.platform === "win32" ? "junction" : "dir");
  for (const entry of [
    path.join(copiedSkill, "scripts", "gemini-bridge.mjs"),
    path.join(linkedSkill, "scripts", "gemini-bridge.mjs"),
    fileURLToPath(new URL("../scripts/gemini-bridge.js", import.meta.url)),
  ]) {
    const child = spawn(process.execPath, [entry, "--print-command", "inspect"], { cwd: scratch, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(code, 0, `${entry}: ${stderr}`);
    assert.equal(await fs.realpath(JSON.parse(stdout).cwd), await fs.realpath(scratch));
  }
});
