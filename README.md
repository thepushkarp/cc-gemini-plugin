# cc-gemini-plugin

Claude Code plugin that integrates [Gemini CLI](https://geminicli.com/) for long-context code exploration and analysis.

## What is this?

This plugin gives Claude Code access to Google Deepmind's Gemini CLI who's **1M token context window** enables "satellite view" analysis - seeing your entire codebase at once rather than file-by-file.

**Use cases:**
- **Whole-codebase architecture understanding** - See all files simultaneously
- **Cross-file security audits** - Trace data flow across modules
- **Refactoring impact analysis** - Find all usages and dependencies
- **Understanding unfamiliar large codebases** - Rapid orientation
- **Documentation generation** - Synthesize README, API docs, architecture docs from full context

## Prerequisites

1. **Install Gemini CLI**
   ```bash
   npm install -g @anthropic-ai/gemini-cli
   # or
   brew install gemini
   ```

2. **Authenticate**
   ```bash
   gemini auth
   ```

3. **Verify installation**
   ```bash
   gemini -p "what is 2+2" --output-format text --yolo
   ```

## Installation

Install via Claude Code's plugin marketplace:

```
/plugin marketplace add thepushkarp/cc-gemini-plugin
```

Or install directly from the repository:

```
/plugin install https://github.com/thepushkarp/cc-gemini-plugin
```

## Usage

### Slash Command

```bash
# Simple query
/gemini explain the architecture of this codebase

# With specific model
/gemini --model gemini-3-flash-preview what does this function do

# With directory context
/gemini --dirs src,lib analyze the module structure

# With file context
/gemini --files "**/*.py" security audit focusing on injection vulnerabilities

# Documentation generation
/gemini --dirs src generate API documentation for all endpoints
```

### Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `--model <name>` | Model override | `--model gemini-3-flash-preview` |
| `--dirs <paths>` | Include directories | `--dirs src,lib` |
| `--files <pattern>` | Pipe files matching glob | `--files "src/**/*.ts"` |
| `<task>` | Analysis task | (required) |

### Available Models

| Option | Description | Models |
|--------|-------------|--------|
| Auto (Gemini 3) | Let the system choose the best Gemini 3 model for your task. | gemini-3-pro-preview (if enabled), gemini-3-flash-preview (if enabled) |
| Auto (Gemini 2.5) | Let the system choose the best Gemini 2.5 model for your task. | gemini-2.5-pro, gemini-2.5-flash |
| Manual | Select a specific model. | Any available model. |

### Autonomous Agent

Claude can automatically spawn the `gemini-agent` for deep exploration tasks. Just ask questions like:

- "Help me understand the architecture of this project"
- "Do a security audit of this codebase"
- "What would be affected if I refactor the auth module?"
- "How does the payment flow work end-to-end?"
- "Generate API documentation for this project"

## Prompt Best Practices

For best results with Gemini:

1. **Be direct** - Skip pleasantries, state the task clearly
2. **Be specific** - "analyze auth module security" > "check security"
3. **Set constraints** - "Focus ONLY on X. Skip Y."
4. **Request format** - "Output as: `file:line - issue - recommendation`"

### Good Prompts

```bash
/gemini --dirs src Analyze all error handling paths. For each: file:line, error type, whether logged, whether recoverable.

/gemini --files "**/*.py" Security audit. Focus ONLY on: SQL injection, command injection, path traversal. Skip style issues.

/gemini --dirs src Generate API documentation. For each endpoint: method, path, parameters, response type, example usage.
```

### Weak Prompts

```bash
/gemini check this code
/gemini is there anything wrong
```

## CLI Reference

The plugin executes Gemini CLI in headless mode:

```bash
# Basic
gemini -p "<PROMPT>" --output-format text --yolo 2>&1

# With model
gemini -p "<PROMPT>" -m gemini-3-flash-preview --output-format text --yolo 2>&1

# With directories
gemini -p "<PROMPT>" --include-directories src,lib --output-format text --yolo 2>&1

# With file context
cat files | gemini -p "<PROMPT>" --output-format text --yolo 2>&1
```

### Key Flags

| Flag | Purpose |
|------|---------|
| `-p` / `--prompt` | Headless mode (required for scripting) |
| `--output-format` | `text`, `json`, `stream-json` |
| `-m` / `--model` | Model selection |
| `--include-directories` | Add directories for context |
| `--yolo` / `-y` | Auto-approve tool actions |

## When to Use (and When Not To)

### Use Gemini For

- Whole-codebase architecture analysis
- Cross-file security audits
- Refactoring impact analysis
- Understanding unfamiliar codebases
- End-to-end flow tracing
- Documentation generation

### Don't Use Gemini For

- Quick single-file edits (use Claude)
- Interactive debugging (needs back-and-forth)
- Speed-critical simple tasks

## Plugin Structure

```
cc-gemini-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── agents/
│   └── gemini-agent.md      # Autonomous agent
├── commands/
│   └── gemini.md            # /gemini slash command
├── skills/
│   └── gemini/
│       └── SKILL.md         # Usage guidance
├── .gitignore
└── README.md
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication error | Run `gemini auth` |
| Rate limiting | Wait and retry |
| Token limit exceeded | Narrow scope with `--files` |
| Timeout | Simplify prompt, reduce context |
| No output | Verify `--output-format text` flag |

## License

MIT

## Author

[thepushkarp](https://github.com/thepushkarp)
