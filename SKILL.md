---
name: gemini-integration
description: Use Antigravity CLI (agy) — or legacy Gemini CLI until 2026-06-18 — for long-context codebase exploration, architecture review, refactor impact analysis, documentation synthesis, or structured data analysis when the host should hand off a large cross-file problem instead of solving it file-by-file.
allowed-tools: Bash, Glob, Read
---

# Antigravity / Gemini CLI Integration

Antigravity CLI (`agy`, Google's successor to Gemini CLI) is the large-context
handoff in this repository. Use it when the task is about the shape of a
system, a broad slice of a repo, or a mixed text dataset that should be
synthesized in one pass. The shared bridge prefers `agy` when on PATH and
transparently falls back to `gemini` during the transition window (Gemini CLI
consumer tiers shut down 2026-06-18).

## When to Use the Long-Context Handoff

### Ideal Cases

| Scenario | Why a long-context handoff fits |
|----------|-----------------|
| Whole-codebase architecture | Broad cross-file synthesis |
| Cross-file security review | Traces flows across modules |
| Refactor impact analysis | Finds dependencies and callers |
| Codebase orientation | Produces a high-level map quickly |
| Documentation generation | Synthesizes behavior from many files |
| Structured data review | Reads JSON, YAML, TOML, CSV, Markdown, and code together |

### Not Ideal

| Scenario | Why |
|----------|-----|
| Quick single-file edits | The handoff adds latency you do not need |
| Tight interactive debugging | Better handled directly by the host model |
| Narrow tasks with no cross-file context | Gemini adds little value |

## Host Entry Points

### Claude Code

Use the slash command:

```bash
/cc-gemini-plugin:gemini <task>
/cc-gemini-plugin:gemini --dirs src,docs <task>
/cc-gemini-plugin:gemini --files "schemas/**/*.json" <task>
```

Claude can also spawn `gemini-agent` when the task obviously benefits from a
large-context pass.

### Codex

- Mention the skill explicitly with `$gemini-integration`.
- Or ask Codex to use the Gemini integration for a large analysis task.

Codex reads this skill definition directly when the repository is installed as a
user-level skill.

## Shared Runtime Contract

Always prefer the shared bridge script over hand-written `agy` or `gemini`
commands:

```bash
node scripts/gemini-bridge.js [options] <task>
```

The bridge owns:
- argument parsing
- directory and file ingestion
- structured prompt assembly
- PATH probe (prefers `agy`, falls back to `gemini`)
- CLI invocation

Use:
- `--dirs <path,...>` for broad module trees
- `--files <glob,...>` for targeted globs and mixed data formats
- `--model <name>` only when the caller explicitly wants a model override
  (gemini only — agy ignores it with a warning; configure the model via
  `~/.gemini/antigravity-cli/settings.json` or `/model` in the TUI)
- `--format json` only when structured output is required (gemini only —
  agy emits text)
- `--print-command` when you need to inspect the resolved CLI invocation

## Good Patterns

### Architecture

```bash
node scripts/gemini-bridge.js --dirs src,docs \
  "Explain the architecture and cite the key files."
```

### Refactor impact

```bash
node scripts/gemini-bridge.js --dirs src \
  "Analyze the impact of refactoring the auth module. Include affected files and migration steps."
```

### Structured data

```bash
node scripts/gemini-bridge.js --files "schemas/**/*.json,data/**/*.csv" \
  "Summarize the data contracts and identify breaking changes."
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication error (agy) | Launch `agy` once and complete the setup wizard |
| Authentication error (gemini, legacy) | Run `gemini auth` |
| Neither CLI on PATH | Install agy: `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
| `--model` warning on agy | Expected — set the model in agy settings instead |
| `--format json` warning on agy | Expected — agy emits text only |
| Rate limiting | Retry with a narrower task or smaller context set |
| Token pressure | Reduce the number of inlined files |
