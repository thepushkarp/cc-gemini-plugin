---
description: Invoke the shared Antigravity/Gemini bridge for long-context code exploration, analysis, and documentation generation
allowed-tools: Bash, Glob, Read
argument-hint: "[--model name] [--dirs path,...] [--files pattern,...] [--format text|json|stream-json] <task>"
---

# /cc-gemini-plugin:gemini Command

Use the shared bridge for long-context code exploration, architecture review,
documentation synthesis, and structured data analysis. The bridge keeps Claude
Code and Codex aligned by collecting local context first and then making one
deterministic call to Antigravity CLI (`agy`) — falling back to legacy Gemini
CLI until consumer tiers shut down on 2026-06-18.

## Usage

```bash
/cc-gemini-plugin:gemini <task>
/cc-gemini-plugin:gemini --model <name> <task>
/cc-gemini-plugin:gemini --dirs <path,...> <task>
/cc-gemini-plugin:gemini --files <pattern,...> <task>
/cc-gemini-plugin:gemini --format json <task>
```

## Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `--model <name>` | Model override (gemini only; agy ignores with warning) | `--model gemini-2.5-pro` |
| `--dirs <paths>` | Recursively inline directories into the bridge context | `--dirs src,docs,data` |
| `--files <pattern,...>` | Inline matching files into the bridge context | `--files "schemas/**/*.json,data/**/*.csv"` |
| `--format <type>` | Output format (gemini only; agy emits text and ignores non-text values) | `--format json` |
| `<task>` | Analysis task or question | (required) |

## Execution Instructions

Parse arguments into:
1. `MODEL` from `--model` if present
2. `DIRS` from `--dirs` if present
3. `FILES` from `--files` if present
4. `FORMAT` from `--format` if present, otherwise `text`
5. `TASK` from the remaining text

Always execute through the shared bridge script:

```bash
node scripts/gemini-bridge.js [--model <MODEL>] [--dirs <DIRS>] [--files <FILES>] [--format <FORMAT>] -- "<TASK>"
```

Guidance:
- Use `--dirs` for broad module or service areas.
- Use `--files` for precise globs or structured data slices.
- Use `--format json` only when the caller explicitly wants machine-readable output.
- Keep the task direct, scoped, and explicit about the output shape.

## Examples

### Simple query
```bash
/cc-gemini-plugin:gemini what is 2+2
```

### Architecture review
```bash
/cc-gemini-plugin:gemini --dirs src,docs explain the architecture of this codebase
```

### Structured data review
```bash
/cc-gemini-plugin:gemini --files "schemas/**/*.json,data/**/*.csv" summarize the data contracts and highlight breaking changes
```

### Model override
```bash
/cc-gemini-plugin:gemini --model gemini-2.5-pro --dirs src analyze the refactor impact of the auth module
```

### JSON output
```bash
/cc-gemini-plugin:gemini --format json --dirs src summarize the public API surface
```

## Best Use Cases

Gemini fits:
- whole-codebase architecture understanding
- cross-file security audits
- refactoring impact analysis
- unfamiliar codebase orientation
- documentation generation
- structured text data synthesis

Gemini is not the right tool for:
- quick single-file edits
- tight interactive debugging loops
- trivial tasks with no cross-file or data-shape component

## Error Handling

| Error | Solution |
|-------|----------|
| Authentication error (agy) | Launch `agy` once and complete the setup wizard |
| Authentication error (gemini, legacy) | Run `gemini auth` |
| Neither CLI on PATH | Install agy: `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
| `--model` warning on agy | Expected — set model in `~/.gemini/antigravity-cli/settings.json` or via `/model` in TUI |
| `--format` non-text warning on agy | Expected — agy emits text only |
| Token limit exceeded | Narrow the inlined scope with `--files` or fewer `--dirs` |
| Timeout | Reduce the context set and tighten the task (agy defaults to 5m print timeout) |
