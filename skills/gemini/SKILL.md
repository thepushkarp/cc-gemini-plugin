---
name: gemini-integration
description: This skill provides guidance on using Google's Gemini CLI for long-context code exploration. Use when the user explicitly invokes "/gemini", asks to "use gemini", "run gemini", or when Claude determines that Gemini's massive context window would complement its work on codebase exploration, architecture review, or cross-file analysis.
allowed-tools: Bash, Glob, Read
---

# Gemini CLI Integration

Gemini CLI leverages Google's Gemini models with a **1M token context window** - ideal for "satellite view" analysis where you need to see the entire codebase at once.

## When to Use Gemini

### Ideal Cases (Gemini excels)

| Scenario | Why Gemini Wins |
|----------|-----------------|
| **Whole-codebase architecture** | See all files simultaneously |
| **Cross-file security audits** | Trace data flow across many modules |
| **Refactoring impact analysis** | Find all usages and dependencies at once |
| **Understanding unfamiliar codebases** | Rapid orientation with full context |
| **End-to-end flow tracing** | Follow execution paths across files |
| **Documentation generation** | Synthesize understanding from entire codebase |

### Not Ideal (Use Claude directly)

| Scenario | Why |
|----------|-----|
| Quick single-file edits | Overkill, slower |
| Interactive debugging | Needs back-and-forth |
| Speed-critical simple tasks | Latency matters |
| Tasks Claude handles well alone | Unnecessary roundtrip |

## How to Invoke

### Via Slash Command
```
/gemini <task>
/gemini --model gemini-3-flash <task>
/gemini --dirs src,lib <task>
/gemini --files "**/*.py" <task>
/gemini --sandbox <task>
```

### Via Agent (autonomous)
Claude can spawn `gemini-agent` automatically for deep exploration tasks.

## CLI Reference

### Headless Mode (for automation)

```bash
# Basic
gemini "<PROMPT>" --output-format text --approval-mode yolo 2>&1

# With model
gemini "<PROMPT>" -m gemini-3-flash --output-format text --approval-mode yolo 2>&1

# With directory context
gemini "<PROMPT>" --include-directories src,lib --output-format text --approval-mode yolo 2>&1

# With file context (piped)
cat src/**/*.ts | gemini "<PROMPT>" --output-format text --approval-mode yolo 2>&1

# With sandbox
gemini "<PROMPT>" --sandbox --output-format text --approval-mode yolo 2>&1
```

### Key Flags

| Flag | Purpose |
|------|---------|
| Positional argument | Headless prompt (preferred) |
| `-p` / `--prompt` | Headless mode prompt (**deprecated**, use positional arg) |
| `-o` / `--output-format` | `text`, `json`, or `stream-json` |
| `-m` / `--model` | Model selection |
| `--include-directories` | Add directories for context |
| `--approval-mode` | Tool approval: `default`, `auto_edit`, `yolo`, `plan` |
| `--yolo` / `-y` | Auto-approve (**deprecated**, use `--approval-mode yolo`) |
| `-s` / `--sandbox` | Run in sandboxed environment |
| `-r` / `--resume` | Resume previous session |
| `-e` / `--extensions` | Enable extensions |
| `-d` / `--debug` | Debug mode with verbose logging |

### Available Models

| Option | Description | Models |
|--------|-------------|--------|
| Auto (Gemini 3) | Let the system choose the best Gemini 3 model for your task. | gemini-3.1-pro-preview (complex tasks), gemini-3-flash (fast tasks) |
| Auto (Gemini 2.5) | Let the system choose the best Gemini 2.5 model for your task. | gemini-2.5-pro, gemini-2.5-flash |
| Manual | Select a specific model. | gemini-3.1-pro-preview, gemini-3-flash, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite |

## Gemini Prompting Best Practices

Based on Google's Gemini 3 prompting guide:

### Structure Principles

1. **Be direct and specific** - Avoid unnecessary preamble
2. **Use consistent delimiters** - XML tags (`<task>`, `<context>`) or markdown
3. **Critical instructions first** - Important constraints at the beginning
4. **Context → Task → Constraints** - Large blocks first, questions last
5. **Keep temperature at 1.0** - Don't lower it (degrades performance)

### Prompt Template

```xml
<context>
[Source material / files / background]
</context>

<task>
[Clear, direct task description]
</task>

<constraints>
- Output format requirements
- What NOT to include
- Scope limits
</constraints>
```

### Code-Specific Prompt Patterns

**Architecture Analysis:**
```
<task>Analyze the architecture of this codebase.</task>
<output>
1. Main entry points
2. Core modules and responsibilities
3. Data flow patterns
4. Key dependencies
Format: Markdown with ASCII diagrams where helpful.
</output>
```

**Security Audit:**
```
<task>Security audit of this codebase.</task>
<focus>auth bypass, injection, data exposure, access control</focus>
<output_format>
`file:line - SEVERITY - issue - recommendation`
Focus ONLY on confirmed issues. Skip style issues.
</output_format>
```

**Refactoring Impact:**
```
<task>Analyze impact of refactoring [COMPONENT].</task>
<analyze>
1. Current state and responsibilities
2. What depends on it
3. What it depends on
4. Files that need changes
5. Migration steps
6. Test plan
</analyze>
```

**End-to-End Flow:**
```
<task>Trace [FEATURE] flow from start to finish.</task>
<output>
For each step:
- file:line reference
- What happens
- Data transformations
- Next step
</output>
```

**Codebase Orientation:**
```
<task>I'm new to this codebase. Provide orientation.</task>
<answer>
1. What does this project do? (1-2 sentences)
2. Main entry points
3. Directory structure overview
4. Key patterns/abstractions
5. How to run/test
</answer>
```

**Documentation Generation:**
```
<task>Generate [TYPE] documentation for this codebase.</task>
<requirements>
1. Purpose: What this module/API/project does
2. Usage: How to use it with examples
3. API Reference: Functions with signatures
4. Configuration: Available options
5. Examples: Working code snippets
</requirements>
<format>Markdown. Include code blocks, tables for reference.</format>
```

## Best Practices

### Scope Discipline
- **Be explicit** about what to focus on
- **Set boundaries** - "Focus ONLY on X. Skip Y."
- **Request specific format** - Makes output actionable

### Good vs Weak Prompts

**Good:**
```
/gemini --dirs src Analyze error handling. For each: file:line, error type, logged?, recoverable?
```

**Weak:**
```
/gemini check this code
```

### Combining with Claude

1. **Gemini explores** - Get the satellite view
2. **Claude synthesizes** - Interpret and act on findings
3. **Claude executes** - Make actual code changes

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication error | Run `gemini auth` |
| Rate limiting | Wait, retry with backoff |
| Token limit exceeded | Narrow scope with `--files` |
| Timeout | Simplify prompt, reduce context |
| Missing output | Check `--output-format text` flag |
