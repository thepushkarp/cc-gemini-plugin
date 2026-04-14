---
name: gemini-integration
description: Use Gemini CLI for long-context codebase exploration, architecture review, refactor impact analysis, documentation synthesis, or structured data analysis when the host should hand off a large cross-file problem instead of solving it file-by-file.
allowed-tools: Bash, Glob, Read
---

# Gemini CLI Integration

Gemini CLI is the large-context handoff in this plugin. Use it when the task is
about the shape of a system, a broad slice of a repo, or a mixed text dataset
that should be synthesized in one pass.

## When to Use Gemini

### Ideal Cases

| Scenario | Why Gemini Fits |
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
/gemini <task>
/gemini --dirs src,docs <task>
/gemini --files "schemas/**/*.json" <task>
```

Claude can also spawn `gemini-agent` when the task obviously benefits from a
large-context pass.

### Codex

- Mention the skill explicitly with `$gemini-integration`.
- Or ask Codex to use the installed `cc-gemini-plugin` for a large analysis task.

Codex reads this same skill definition and routes to the same bridge script.

## Shared Runtime Contract

Always prefer the shared bridge script over hand-written `gemini` commands:

```bash
node scripts/gemini-bridge.js [options] <task>
```

The bridge owns:
- argument parsing
- directory and file ingestion
- structured prompt assembly
- Gemini CLI invocation

Use:
- `--dirs <path,...>` for broad module trees
- `--files <glob,...>` for targeted globs and mixed data formats
- `--model <name>` only when the caller explicitly wants a model override
- `--format json` only when structured output is required
- `--print-command` when you need to inspect the resolved Gemini command

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
| Authentication error | Run `gemini auth` |
| Gemini missing on PATH | Install `@google/gemini-cli` or `brew install gemini-cli` |
| Rate limiting | Retry with a narrower task or smaller context set |
| Token pressure | Reduce the number of inlined files |
