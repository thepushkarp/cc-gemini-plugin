import process from "node:process";
import { spawn } from "node:child_process";
import { once } from "node:events";

const scenario = process.env.AGY_TEST_SCENARIO;
let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const result = {
  status: "SUCCESS", response: "The analysis.\n", conversation_id: "conversation-opaque",
  usage: { input_tokens: 3, output_tokens: 5 }, denied_actions: [],
};

emit({ event: "init", init: { conversation_id: "conversation-opaque" } });
emit({ event: "step_update", step_update: { state: "ACTIVE", step_type: "agent_response", text_delta: "The analysis." } });
emit({ event: "future_progress", detail: "preserve me" });

if (scenario === "echo") {
  result.response = JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), input, eof: true });
} else if (scenario === "denied") {
  result.denied_actions = [{ tool: "run_command", command: "bun run test", reason: "Permission denied" }];
} else if (scenario === "empty") {
  result.response = "";
} else if (scenario === "whitespace") {
  result.response = " \n\t";
} else if (scenario === "failed-result") {
  result.status = "ERROR";
} else if (scenario === "malformed-result") {
  result.response = null;
} else if (scenario === "recovered-tool-error") {
  emit({ event: "step_update", step_update: { state: "ERROR", step_type: "tool", error: "Transient read failure; retried" } });
} else if (scenario === "nonzero") {
  process.stderr.write("IneligibleTierError: client no longer supported\n");
  process.exitCode = 23;
} else if (scenario === "hang") {
  await new Promise(() => setInterval(() => {}, 60_000));
} else if (scenario === "delegated-child") {
  const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); process.send(process.pid); setInterval(() => {}, 60000);"], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const [pid] = await once(child, "message");
  emit({ event: "delegated_child", pid });
  await new Promise(() => setInterval(() => {}, 60_000));
} else if (scenario === "malformed") {
  process.stdout.write("not JSON\n");
} else if (scenario === "await-progress") {
  await once(process, "message");
  process.disconnect();
}

if (scenario !== "missing") {
  const record = `${JSON.stringify({ event: "result", result })}\n`;
  const splitAt = Math.floor(record.length / 2);
  process.stdout.write(record.slice(0, splitAt));
  await new Promise((resolve) => setTimeout(resolve, 5));
  process.stdout.write(record.slice(splitAt));
  if (scenario === "duplicate") emit({ event: "result", result });
}
