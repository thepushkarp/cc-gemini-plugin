---
description: Invoke Gemini CLI for long-context code exploration, analysis, and documentation generation
allowed-tools: Bash, Glob, Read
argument-hint: "[--model name] [--dirs path,...] [--files pattern] [--sandbox] <task>"
---

# /gemini Command

Invoke Gemini CLI for long-context code exploration, analysis, and documentation generation. Gemini's 1M token context window makes it ideal for whole-codebase understanding, cross-file analysis, architectural review, and synthesizing documentation from full codebase context.

## Usage

```
/gemini <task>
/gemini --model <name> <task>
/gemini --files <pattern> <task>
/gemini --dirs <path,...> <task>
/gemini --sandbox <task>
```

## Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `--model <name>` | Model override | `--model gemini-3-flash` |
| `--files <pattern>` | Pipe files matching glob | `--files "src/**/*.ts"` |
| `--dirs <paths>` | Include directories for context | `--dirs src,lib,tests` |
| `--sandbox` | Run in sandboxed environment | `--sandbox` |
| `<task>` | Analysis task or question | (required) |

## Available Models

| Option | Description | Models |
|--------|-------------|--------|
| Auto (Gemini 3) | Let the system choose the best Gemini 3 model for your task. | gemini-3.1-pro-preview (complex tasks), gemini-3-flash (fast tasks) |
| Auto (Gemini 2.5) | Let the system choose the best Gemini 2.5 model for your task. | gemini-2.5-pro, gemini-2.5-flash |
| Manual | Select a specific model. | gemini-3.1-pro-preview, gemini-3-flash, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite |

## Execution Instructions

Parse arguments to extract:
1. `MODEL` - from `--model` flag (optional)
2. `FILES` - from `--files` flag (optional)
3. `DIRS` - from `--dirs` flag (optional)
4. `SANDBOX` - presence of `--sandbox` flag (optional)
5. `TASK` - remaining text after parsing

### Command Construction

**Basic (default model):**
```bash
gemini "<TASK>" --output-format text --approval-mode yolo 2>&1
```

**With model override:**
```bash
gemini "<TASK>" -m <MODEL> --output-format text --approval-mode yolo 2>&1
```

**With file context (piped):**
```bash
cat <FILES> | gemini "<TASK>" --output-format text --approval-mode yolo 2>&1
```

**With directory context:**
```bash
gemini "<TASK>" --include-directories <DIRS> --output-format text --approval-mode yolo 2>&1
```

**Combined (model + directories):**
```bash
gemini "<TASK>" -m <MODEL> --include-directories <DIRS> --output-format text --approval-mode yolo 2>&1
```

**With sandbox:**
```bash
gemini "<TASK>" --sandbox --output-format text --approval-mode yolo 2>&1
```

### Flag Reference

| Flag | Purpose |
|------|---------|
| Positional argument | Headless prompt (preferred) |
| `-p` / `--prompt` | Headless mode prompt (**deprecated**, use positional arg) |
| `-o` / `--output-format` | Output: `text`, `json`, `stream-json` |
| `-m` / `--model` | Model selection |
| `--include-directories` | Add directories for context |
| `--approval-mode` | Tool approval: `default`, `auto_edit`, `yolo`, `plan` |
| `--yolo` / `-y` | Auto-approve (**deprecated**, use `--approval-mode yolo`) |
| `-s` / `--sandbox` | Run in sandboxed environment |
| `-r` / `--resume` | Resume previous session |
| `-e` / `--extensions` | Enable extensions |
| `-d` / `--debug` | Debug mode with verbose logging |
| `2>&1` | Capture stderr |

## Examples

### Simple query
```
/gemini what is 2+2
```
→ `gemini "what is 2+2" --output-format text --approval-mode yolo 2>&1`

### Architecture analysis
```
/gemini explain the architecture of this codebase
```
→ `gemini "explain the architecture of this codebase" --output-format text --approval-mode yolo 2>&1`

### With directory context
```
/gemini --dirs src,lib analyze the module structure
```
→ `gemini "analyze the module structure" --include-directories src,lib --output-format text --approval-mode yolo 2>&1`

### With file context
```
/gemini --files "src/**/*.ts" summarize the main modules
```
→ `cat src/**/*.ts | gemini "summarize the main modules" --output-format text --approval-mode yolo 2>&1`

### With model override
```
/gemini --model gemini-3-flash what does this function do
```
→ `gemini "what does this function do" -m gemini-3-flash --output-format text --approval-mode yolo 2>&1`

### Security review with Pro model
```
/gemini --model gemini-3.1-pro-preview --dirs src security audit focusing on auth and injection
```
→ `gemini "security audit focusing on auth and injection" -m gemini-3.1-pro-preview --include-directories src --output-format text --approval-mode yolo 2>&1`

### Documentation generation
```
/gemini --dirs src generate API documentation for all endpoints
```
→ `gemini "generate API documentation for all endpoints" --include-directories src --output-format text --approval-mode yolo 2>&1`

### Sandboxed execution
```
/gemini --sandbox --dirs src analyze and test the build pipeline
```
→ `gemini "analyze and test the build pipeline" --include-directories src --sandbox --output-format text --approval-mode yolo 2>&1`

## Prompt Best Practices

For best results with Gemini:

1. **Be direct** - Skip pleasantries, state the task clearly
2. **Be specific** - "analyze auth module security" > "check security"
3. **Set constraints** - "Focus ONLY on X. Skip Y."
4. **Request format** - "Output as: `file:line - issue - recommendation`"

### Good Prompts
```
/gemini --dirs src Analyze all error handling paths. For each: file:line, error type, whether it's logged, whether it's recoverable.
```

```
/gemini --files "**/*.py" Security audit. Focus ONLY on: SQL injection, command injection, path traversal. Skip style issues.
```

### Weak Prompts
```
/gemini check this code
/gemini is there anything wrong
```

## Best Use Cases

**Gemini excels at:**
- Whole-codebase architecture understanding
- Cross-file security audits (trace data flow)
- Refactoring impact analysis (find all usages)
- Understanding unfamiliar large codebases
- End-to-end flow tracing
- Documentation generation (README, API docs, architecture docs)

**Not ideal for:**
- Quick single-file edits (use Claude)
- Interactive debugging (needs back-and-forth)
- Speed-critical simple tasks

## Error Handling

| Error | Solution |
|-------|----------|
| Rate limiting | Wait and retry |
| Token limit exceeded | Narrow scope with `--files` |
| Authentication error | Run `gemini auth` |
| Timeout | Simplify prompt, reduce context |
