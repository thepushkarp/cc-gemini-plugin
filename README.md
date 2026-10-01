# cc-gemini-plugin

Delegate tasks through Antigravity CLI (`agy`) from Claude Code, Codex, and other
Agent Skills hosts, using its models, tools, and separate working context.

Claude Code provides `/cc-gemini-plugin:gemini` and `gemini-agent`. The portable
`gemini-integration` skill uses the same runtime and can be installed separately.
Delegate reasoning, research, writing, coding, data analysis, automation, or
other work supported by the installed environment. Native tools can read and
edit files and run permitted commands; web, browser, MCP, and subagent tools
depend on the session's available capabilities and configuration. See Google's
[CLI overview](https://antigravity.google/docs/cli/overview/) and
[MCP documentation](https://antigravity.google/docs/mcp/).

Give `agy` a useful task, relevant references, and a clear desired result. Run
independent tasks in parallel when appropriate, reuse explicit conversations
for related follow-ups, and adapt to reported limits instead of assuming fixed
model capacities or quotas.

## Requirements

- Node.js 22 or newer.
- Antigravity CLI available as `agy` on macOS/Linux or native `agy.exe` on Windows.
- Completed `agy` authentication and network access to its service.

Follow Google's [CLI installation and authentication guide](https://antigravity.google/docs/cli/),
then launch `agy` once to complete setup. Check the installation with:

```bash
agy --version
agy -p "Reply with OK."
agy models
```

The bridge uses `agy` exclusively. Google ended consumer Gemini CLI service on
June 18, 2026; enterprise licenses and paid API-key access continue to be
supported. See the [Google announcement](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
for the distinction.

The development baseline is `agy` 1.2.14, checked on October 1, 2026. Model
identifiers and effort values come from the installed CLI; this project keeps no
model catalogue or model-family routing rules. See the current
[headless interface](https://antigravity.google/docs/cli/headless/) and
[execution modes](https://antigravity.google/docs/cli/modes/).

## Installation

### Claude Code plugin

In Claude Code:

```text
/plugin marketplace add thepushkarp/cc-gemini-plugin
/plugin install cc-gemini-plugin@cc-gemini-plugin
/reload-plugins
```

Use `/cc-gemini-plugin:gemini <task>` or delegate a suitable task to
`gemini-agent`. To update, run these commands in your shell:

```bash
claude plugin marketplace update cc-gemini-plugin
claude plugin update cc-gemini-plugin@cc-gemini-plugin
```

Then run `/reload-plugins` in Claude Code. You can also select **Update now**
from the Installed tab in `/plugin`.

### Codex and other Agent Skills hosts

Install with the [Vercel skills CLI](https://github.com/vercel-labs/skills)
using [Bun](https://bun.sh/docs/installation):

```bash
bunx skills add thepushkarp/cc-gemini-plugin --skill gemini-integration
```

Select the desired hosts interactively, or specify one. For a user-level Codex
installation available across projects:

```bash
bunx skills add thepushkarp/cc-gemini-plugin --skill gemini-integration -g -a codex
```

Use `$gemini-integration` in Codex. Implicit skill selection remains enabled.
Other supported hosts can be selected with `-a`, including `claude-code`,
`cursor`, and `opencode`. Installing only the skill in Claude does not install
the plugin's namespaced command or agent; choose the plugin above for those.

The installer supports symlinks to a canonical copy, or `--copy` for independent
copies. The entire skill directory is self-contained, including the runtime;
neither method requires a repository checkout or package installation. Update
an installer-managed skill with `bunx skills update gemini-integration` (add `-g`
for only the global installation).

For local development, run the same installer with `.` as the source from this
checkout. Manual installations should copy or symlink the whole
`skills/gemini-integration/` directory, not just `SKILL.md`. Codex discovers
user skills under `~/.agents/skills/` and project skills under `.agents/skills/`.
See [Codex skill documentation](https://developers.openai.com/codex/skills/).

### Host compatibility

| Component | Supported use |
| --- | --- |
| `skills/gemini-integration/` | Shared Agent Skill and runtime for Claude Code, Codex, and other Agent Skills hosts with local command execution. |
| `.claude-plugin/`, `commands/gemini.md`, `agents/gemini-agent.md` | Claude Code plugin packaging, namespaced command, and subagent adapter. |
| `skills/gemini-integration/agents/openai.yaml` | Optional Codex skill metadata and invocation policy; not a subagent definition. |

Install the shared skill for the target host through the skills CLI. Host-specific
command names, subagent definitions, and plugin installation formats are not
part of the Agent Skills standard. OpenAI supports importing Claude skill
packages through its [plugin conversion flow](https://developers.openai.com/plugins/guides/submit-claude-plugin),
but Claude commands and agents need their behavior expressed as skills. This
repository keeps that behavior in the shared skill already. Each execution
environment still needs Node and an authenticated `agy` installation.

## Delegation and permissions

The bridge has one read/write workflow using `agy`'s native `accept-edits`
setting. The task determines whether to analyze, modify files, or run checks;
no bridge mode flag is needed. For a review without edits, say so in the task.
File edits are accepted automatically, while commands still follow the user's
configured permissions. The bridge never bypasses command permissions or edits
settings.
Use `--sandbox` to request the native terminal sandbox; it does not confine every
agent operation to the workspace.

The delegate reads files directly in `--cwd`, which defaults to the caller's
working directory. Put scope, file references, constraints, and the desired
result in the task. The bridge transmits that text unchanged, without adding
instructions or collecting files. Keep secrets and unrelated private data
outside the requested scope.

The shared skill guides delegation and verification. Capture workspace state
when files may change, avoid overlapping edits, and assess the result according
to the task: changed files and test evidence, research sources, or the generated
artifact. Additional host checks depend on the evidence and risk. Unexpected
changes are reported without automatic rollback. Failed runs may leave partial
results or changes; inspect them before deciding whether to retry.

## Bridge interface

From a repository checkout:

```bash
node skills/gemini-integration/scripts/gemini-bridge.mjs [options] -- "<task>"
```

An installed skill runs `scripts/gemini-bridge.mjs` relative to its own
`SKILL.md`, with an absolute script path and a separate target `--cwd`.

| Option | Meaning |
| --- | --- |
| `<task>` | Required task; `--` ends option parsing. |
| `--cwd <path>` | Target workspace; defaults to the caller's working directory. |
| `--model <id>` | Opaque model override; omitted by default. Discover with `agy models`. |
| `--effort <value>` | Opaque effort override; omitted by default and validated by `agy`. |
| `--conversation <id>` | Explicit conversation to resume, obtained from a previous result. |
| `--format text\|json\|stream-json` | Output format, default `text`. |
| `--timeout <seconds>` | Positive time limit, default 600; native timeout plus parent watchdog. |
| `--sandbox` | Enable the native terminal sandbox. |
| `--print-command` | Print a JSON launch description without invoking `agy`. |

Tasks travel in one NDJSON stdin message, and `agy` is launched without a shell.
Programmatic requests disable slash-command expansion. The bridge does not look
up a latest conversation or read private conversation databases. It does not
automatically retry failed runs.

### Examples

Research and synthesis:

```bash
node skills/gemini-integration/scripts/gemini-bridge.mjs -- \
  "Compare the options in docs and research missing information using available tools. Return a recommendation with sources and uncertainties."
```

Delegated implementation:

```bash
node skills/gemini-integration/scripts/gemini-bridge.mjs --cwd /path/to/project --format json -- \
  "Fix the parser's handling of empty input. Limit edits to parser code and its tests. Run the relevant tests and report results."
```

Resume a selected conversation:

```bash
node skills/gemini-integration/scripts/gemini-bridge.mjs --conversation "<returned-conversation-id>" --format json -- \
  "Explain the remaining tradeoffs using the same workspace."
```

### Output and failures

- `text`: response text on stdout; diagnostics and failures on stderr.
- `json`: `{ "ok": boolean, "result": nativeResultOrNull, "error": stringOrNull }`.
- `stream-json`: native progress events, followed by one bridge terminal event:
  `{ "event": "result", "ok": boolean, "result": nativeResultOrNull, "error": stringOrNull }`.

Native metadata, including conversation identifiers, stays inside `result`.
Partial responses are preserved. Callers must check the exit code and `ok`:
process failure, timeout, invalid or missing results, an empty response,
unsuccessful terminal status, or reported denied actions produce a nonzero exit.
Native `SUCCESS` alone does not establish completion. A recovered tool error
does not automatically invalidate an otherwise completed response.

## Migrating from 1.x

Version 2 requires `agy`; there is no Gemini CLI fallback. Use
`skills/gemini-integration/scripts/gemini-bridge.mjs` with the task after `--`.
The root launcher, `--task`, `--dirs`, `--files`, and file-ingestion limit options
are unsupported. Put scope and file references directly in the task. JSON
consumers must read the bridge envelope described above.

The plugin, command, agent, and skill names are preserved. The canonical skill
lives at `skills/gemini-integration/`.

If you previously cloned the repository into
`~/.agents/skills/cc-gemini-plugin`, preserve any local edits and move that clone
to a normal checkout directory outside skill discovery paths. Install the
canonical skill using the command above, or symlink its directory from that
checkout. This avoids discovering duplicate skills or relying on obsolete root
files. For a manual symlink installation, update the checkout normally; for an
installer-managed copy, use `bunx skills update gemini-integration`.

## Development and contributions

Use the Bun version declared in `package.json` for development:

```bash
bun install --frozen-lockfile
bun run test
```

The test script runs Node's test runner to verify the shipped runtime. CI uses
Bun to run these checks on Node 22 and 24 across Linux, macOS, and Windows.
Installed skills require Node, with no Bun dependency. Live checks require an
authenticated CLI; use disposable workspaces for implementation tests.

Local validation on October 1, 2026 passed all 28 automated checks on macOS
with Node.js 22.23.3 and 26.8.2. Live checks used `agy` 1.2.14: analysis read
the fixture without modifying it using the same default workflow as edits;
explicit conversation resumption, model and
effort overrides, and streamed output passed. A denied action with native
`SUCCESS` produced bridge exit 1. A delegated one-file arithmetic fix passed
the existing test when independently run by the host. Vercel skills 1.7.0 copy
and symlink installs for Claude Code and Codex included the complete runtime,
which ran from an unrelated working directory. Copy installation also passed
for Cursor and OpenCode.

The integration history retains the contributor commits from
[wicojan's PR #5](https://github.com/thepushkarp/cc-gemini-plugin/pull/5)
(Antigravity support) and
[creatrco's PR #8](https://github.com/thepushkarp/cc-gemini-plugin/pull/8)
(unusable-result handling). Portable launch paths, native Windows executable
selection, and stdin transport address the failure reports in
[issues #4](https://github.com/thepushkarp/cc-gemini-plugin/issues/4) and
[#9](https://github.com/thepushkarp/cc-gemini-plugin/issues/9). The migration also
addresses the consumer-service concern raised in
[issue #7](https://github.com/thepushkarp/cc-gemini-plugin/issues/7).

The skill follows the [Agent Skills specification](https://agentskills.io/specification)
and [Claude skill conventions](https://code.claude.com/docs/en/skills).
Reference projects include [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills)
for portable packaging, [Trail of Bits second-opinion](https://github.com/trailofbits/skills/tree/main/plugins/second-opinion)
for review scope and failure reporting, and
[Sparkling Skills dispatch](https://github.com/sparklingneuronics/sparkling-skills)
for conversation-based follow-ups. CLI contracts follow current upstream
documentation and local probes rather than copied model tables.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| `agy` cannot be launched | Install the native CLI and ensure its directory is on the host agent's PATH; restart the host after PATH changes. On Windows use `agy.exe`, not a `.cmd` wrapper. |
| Authentication failure | Launch `agy` interactively and complete setup. |
| Denied action or empty response | Inspect `error` and native `result`; report the blocked work instead of treating it as completed. |
| Timeout | Inspect partial edits first; narrow the task or explicitly increase `--timeout` for a subsequent run. |
| Unsupported model or effort | Consult the installed `agy` CLI and `agy models`; omit the override to use configured defaults. |
| Skill is missing after installation | Confirm the entire canonical skill directory was installed; restart the host if discovery has not refreshed. |

## License

MIT
