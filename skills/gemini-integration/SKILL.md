---
name: gemini-integration
description: Delegate broad codebase analysis or scoped implementation to Gemini through Antigravity CLI (agy). Use for cross-file reviews, refactor impact, codebase orientation, or an explicitly delegated edit-and-test task.
compatibility: Requires Node.js 22 or newer, authenticated Antigravity CLI (agy) on PATH, network access, and a host able to execute local commands.
---

# Gemini Integration

Use the bundled bridge to delegate a task to `agy`, which reads the target
workspace itself. Prefer the host's own tools for small tasks that do not benefit
from a separate agent.

## Locate the bridge and scope the task

Resolve `scripts/gemini-bridge.mjs` relative to **this loaded SKILL.md file**.
Use its absolute path; the skill may be copied or symlinked anywhere. Identify
the user's target workspace separately and pass its absolute path as `--cwd`.
Do not change into the installation directory to analyze the user's project.

Before delegation, capture the relevant workspace state (Git status and diff
when available). Give `agy` the task, allowed scope, constraints, acceptance
criteria, and desired evidence. For review, request concrete findings with file
and line references; for implementation, request a change summary and the
commands and results used to verify it. Exclude secrets and unrelated private
data from prompts and requested scope.

Choose the mode from the user's authorization:

- `--mode analyze` is the default. Request findings without edits. This is an
  instruction, **not enforced read-only access**: `agy` retains its configured
  permissions. Surface unexpected modifications; do not roll them back.
- `--mode execute` delegates authorized edits and commands using `agy`'s native
  `accept-edits` mode. Give it a bounded task and keep other agents from editing
  the same files concurrently. Commands still follow configured permissions.

The bridge does not bypass permissions or modify settings. `--sandbox` opts into
the native terminal sandbox; it does not confine every agent operation to the
workspace. `--dirs` and `--files` provide focus hints, not filesystem restrictions
or automatic file attachments.

## Run the task

Substitute the resolved skill and workspace paths in this example:

```bash
node "<skill-directory>/scripts/gemini-bridge.mjs" \
  --cwd "<target-workspace>" --format json --dirs src,docs -- \
  "Explain the architecture. Cite the key files and unresolved questions."
```

For delegated implementation, add `--mode execute` and specify the permitted
changes and acceptance checks. Quote arguments for the host shell, or use an
argument-array execution API when available. Never splice untrusted task text
into executable shell syntax. The bridge sends the task to `agy` over stdin.

| Option | Use |
| --- | --- |
| `--model <id>` | Optional override; omit to use the configured default. Discover IDs with `agy models`. |
| `--effort <value>` | Optional native effort override; let `agy` validate supported values. |
| `--conversation <id>` | Resume the exact conversation ID returned by an earlier result. |
| `--dirs <path,...>` / `--files <pattern,...>` | Focus instructions relative to the workspace; quote globs. |
| `--format text\|json\|stream-json` | Default `text`; use `json` for reliable result inspection. |
| `--timeout <seconds>` | Positive time limit, default 600; the bridge also enforces a watchdog. |
| `--print-command` | Print a JSON launch description without running `agy`. |

Do not hard-code model names or choose model-specific behavior. Omit model and
effort overrides unless supplied or explicitly requested by the caller. Resume
only an explicitly selected conversation in the intended workspace, never an
implicit latest session or a private database lookup. Programmatic requests
disable slash-command expansion.

## Assess and verify the result

JSON output is `{ "ok": boolean, "result": nativeResultOrNull, "error":
stringOrNull }`. Streaming output forwards native progress events and ends with
`{ "event": "result", "ok": boolean, "result": nativeResultOrNull, "error":
stringOrNull }`. Preserve the native conversation ID for useful follow-ups.

Check the bridge exit code and `ok`, not just the native status: `agy` may report
success even after denying an action. Permission denials, empty responses,
missing or malformed results, process failures, and timeouts are failures;
partial native results remain available. Recovered tool errors do not alone
invalidate a completed response. Text mode prints response text to stdout and
failure explanations to stderr.

Inspect the relevant before/after workspace differences and preserve unrelated
or concurrent changes. Verify material claims and run the appropriate checks in
the host before reporting completion. Distinguish verified results from the
delegate's claims. If permission blocks the task, report the denied operation
without escalating permissions or changing settings. Do not automatically retry
implementation after failure or timeout; first inspect partial edits and tests.

If `agy` is missing or authentication fails, point to the
[official setup documentation](https://antigravity.google/docs/cli/) and ask the
user to complete authentication interactively with `agy`. Do not fall back to
Gemini CLI or install tools or credentials implicitly.
