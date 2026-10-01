---
description: Delegate tasks through Antigravity CLI using its available models, tools, and working context
allowed-tools: Bash, Glob, Read
argument-hint: "[--model id] [--effort value] [--cwd path] [--dirs path,...] [--files pattern,...] [--format text|json|stream-json] <task>"
---

Read `${CLAUDE_PLUGIN_ROOT}/skills/gemini-integration/SKILL.md` and follow its
shared workflow for the request below. Parse the supplied bridge options as data;
do not interpolate the raw request into a shell command.

Invoke `node` with the absolute installed bridge path
`${CLAUDE_PLUGIN_ROOT}/skills/gemini-integration/scripts/gemini-bridge.mjs`.
Pass the target workspace as `--cwd`, independently of the plugin location,
and preserve explicit options. Safely quote individual shell arguments or use
an argument-array API. Let the task determine the required reads, edits, and
checks. Report results only after inspecting the bridge outcome and verifying
relevant workspace changes and checks.

User request:

$ARGUMENTS
