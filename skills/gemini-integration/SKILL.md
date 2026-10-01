---
name: gemini-integration
description: Delegate tasks to Antigravity CLI (agy) to use its models, tools, and separate working context. Use when delegation can improve efficiency, provide another perspective, or let independent work proceed in parallel.
compatibility: Requires Node.js 22 or newer, authenticated Antigravity CLI (agy) on PATH, network access, and a host able to execute local commands.
---

# Gemini Integration

Use the bundled bridge to delegate work to `agy`. Tasks can involve reasoning,
research, writing, coding, data analysis, automation, or any other work supported
by the installed environment. Let the requested outcome and available tools
determine the approach.

## Delegate efficiently

Give the delegate enough context to own a useful piece of work and return a
usable result. Prefer file and resource references over copying material it can
read itself. State what completion means and ask for the output and evidence the
host needs to integrate the result. When handing off stuck work, include prior
attempts and their observed outcomes, unresolved questions, and any partial
changes. Separate established facts from suspected explanations so the delegate
can investigate independently.

Run independent tasks in parallel when useful, with distinct outputs or file
ownership. Avoid duplicating active work. Reuse an explicit conversation for
related follow-ups, sending the new instruction and any changed facts rather
than replaying the whole handoff. Keep unrelated tasks in separate conversations.

Native tools support workspace search, file reads and edits, and permitted
commands. Use web, browser, MCP, or subagent tools when exposed by the installed
session; availability depends on configuration and permissions. The native
`init.tools` list in `stream-json` output describes the session's advertised
tools. Do not assume an advertised tool is configured or authorized for every
operation.

Use the installed CLI's help, `agy models`, usage metadata, and reported limits
when deciding how much work to delegate. Do not assume fixed context windows,
quotas, or concurrency limits. Match task size to the timeout and available
capacity; use partial results to decide what to finish in the host or delegate
as a smaller follow-up.

## Locate the bridge and scope the task

Resolve `scripts/gemini-bridge.mjs` relative to **this loaded SKILL.md file**.
Use its absolute path; the skill may be copied or symlinked anywhere. Identify
the user's target workspace separately and pass its absolute path as `--cwd`.
Do not use the installation directory as the task's workspace.

Give `agy` the desired outcome, relevant context or references, scope, and
constraints. Put file and directory focus directly in the task. Request a result
summary and the evidence needed to assess it, such as sources, artifacts, or
check results. The bridge transmits task text unchanged; it adds no instructions.
Exclude secrets and unrelated private data from the requested scope.

For tasks that may change files, capture the relevant starting state (Git status
and diff when available) and identify work that must be preserved.

The bridge uses one read/write workflow with `agy`'s native `accept-edits`
setting. Let the task determine whether to inspect, edit, or run checks; specify
constraints such as "do not modify files" in the task when needed. Commands
still follow configured permissions. Keep other agents from editing the same
files concurrently. Surface unexpected modifications without rolling them back.

The bridge does not bypass command permissions or modify settings. `--sandbox`
opts into the native terminal sandbox; it does not confine every agent operation
to the workspace. Task scope is guidance, not a filesystem restriction.

## Run the task

Substitute the resolved skill and workspace paths in this example:

```bash
node "<skill-directory>/scripts/gemini-bridge.mjs" \
  --cwd "<target-workspace>" --format json -- \
  "<task, relevant context, constraints, and desired result>"
```

Quote arguments for the host shell, or use an argument-array execution API when
available. Never splice untrusted task text into executable shell syntax. The
bridge sends the task to `agy` over stdin.

| Option | Use |
| --- | --- |
| `--model <id>` | Optional override; omit to use the configured default. Discover IDs with `agy models`. |
| `--effort <value>` | Optional native effort override; let `agy` validate supported values. |
| `--conversation <id>` | Resume the exact conversation ID returned by an earlier result. |
| `--format text\|json\|stream-json` | Default `text`; use `json` for reliable result inspection. |
| `--timeout <seconds>` | Positive time limit, default 600; the bridge also enforces a watchdog. |
| `--print-command` | Print a JSON launch description without running `agy`. |

Do not hard-code model names or choose model-specific behavior. Omit model and
effort overrides unless supplied or explicitly requested by the caller. Resume
only an explicitly selected conversation in the intended workspace, never an
implicit latest session or a private database lookup. Programmatic requests
disable slash-command expansion.

If the host returns a running-process handle, use its wait or cancellation
facility for that invocation. A process handle is not an `agy` conversation ID,
and yielding control does not mean the task failed. Use `stream-json` when
progress matters; quiet output alone is not a reason to launch the task again.

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

Match verification to the deliverable: inspect changed files and relevant test
evidence for implementation, check sources for research, and review the artifact
for writing or generation. Run additional host checks when the evidence or risk
warrants them; do not repeat delegated work by default. Distinguish verified
results from the delegate's claims. Preserve uncertainty, failed checks, and
unfinished work when summarizing; keep unrelated changes intact.

## Continue or recover

Before retrying or taking over, confirm the previous process has ended and
inspect its diagnostics, partial results, and any changed state. Report what
completed and what remains blocked. Correct the cause or narrow the remaining
task instead of repeating the same request automatically.

For related work, resume the exact returned conversation ID in the same
workspace and describe what remains plus any changes made since that run. If no
ID is available or the task needs a fresh start, make a new invocation with a
concise handoff. Keep the delegate's outcome distinct from any work the host
subsequently completes. Permission failures require reporting the denied
operation, without bypassing permissions or changing settings.

If `agy` is missing or authentication fails, point to the
[official setup documentation](https://antigravity.google/docs/cli/) and ask the
user to complete authentication interactively with `agy`. Do not fall back to
Gemini CLI or install tools or credentials implicitly.
