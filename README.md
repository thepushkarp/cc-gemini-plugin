# cc-gemini-plugin

Dual-host Gemini CLI integration for Claude Code and Codex.

The repository provides one shared Gemini runtime and two thin host adapters:
- Claude Code uses the existing plugin manifest, `/gemini` command, and `gemini-agent`.
- Codex uses `.codex-plugin/plugin.json`, the shared skill, and repo-local marketplace metadata.

The plugin gives the host a clean way to hand large, cross-file analysis tasks
to Gemini instead of solving everything file-by-file.

## Architecture

- Shared bridge runtime at `scripts/gemini-bridge.js`
- Claude Code integration through the plugin manifest, `/gemini` command, and `gemini-agent`
- Codex integration through `.codex-plugin/plugin.json`, the shared skill, and repo-local
  marketplace metadata
- Bridge coverage in `tests/gemini-bridge.test.js`

## Use Cases

- whole-codebase architecture understanding
- cross-file security audits
- refactor impact analysis
- unfamiliar codebase orientation
- documentation generation
- structured text data synthesis across JSON, YAML, TOML, CSV, Markdown, and code

## Prerequisites

1. Install Gemini CLI

```bash
npm install -g @google/gemini-cli
# or
brew install gemini-cli
```

2. Authenticate

```bash
gemini auth
```

3. Verify Gemini works

```bash
gemini -p "what is 2+2" --output-format text
```

## Installation

### Claude Code

Install from the repository:

```bash
/plugin install https://github.com/thepushkarp/cc-gemini-plugin
```

### Codex

This repo includes both:
- `.codex-plugin/plugin.json`
- `.agents/plugins/marketplace.json`

That means the repository can act as a local Codex plugin and a repo-local
marketplace during development.

For a personal Codex install, the documented pattern is:

```bash
mkdir -p ~/.codex/plugins
cp -R /absolute/path/to/cc-gemini-plugin ~/.codex/plugins/cc-gemini-plugin
```

Then expose it from `~/.agents/plugins/marketplace.json`, or use the repo-local
marketplace while developing in this repository.

## Shared Runtime

Both hosts route through:

```bash
node scripts/gemini-bridge.js [options] <task>
```

Supported options:
- `--model <name>`
- `--dirs <path,...>`
- `--files <glob,...>`
- `--format <text|json|stream-json>`
- `--max-files <n>`
- `--max-file-bytes <n>`
- `--print-command`

The bridge:
- collects files and directories locally
- inlines text-like content into a structured prompt
- skips unsupported binary files
- invokes Gemini CLI in headless mode

## Host Entry Points

### Claude Code

Use:

```bash
/gemini <task>
/gemini --dirs src,docs <task>
/gemini --files "schemas/**/*.json,data/**/*.csv" <task>
```

### Codex

Use the bundled skill:

```text
$gemini-integration
```

Or ask Codex to use the installed `cc-gemini-plugin` for a large-context pass.

Codex-specific skill metadata lives in `skills/gemini/agents/openai.yaml`.

## Examples

Architecture review:

```bash
node scripts/gemini-bridge.js --dirs src,docs \
  "Explain the architecture and cite the key files."
```

Refactor impact:

```bash
node scripts/gemini-bridge.js --dirs src \
  "Analyze the impact of refactoring the auth module. Include affected files and migration steps."
```

Structured data review:

```bash
node scripts/gemini-bridge.js --files "schemas/**/*.json,data/**/*.csv" \
  "Summarize the data contracts and identify breaking changes."
```

Structured output:

```bash
node scripts/gemini-bridge.js --format json --dirs src \
  "Summarize the public API surface."
```

## Development

Run the bridge tests:

```bash
npm test
```

## Repository Structure

```text
cc-gemini-plugin/
├── .agents/plugins/marketplace.json
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── .codex-plugin/
│   └── plugin.json
├── agents/
│   └── gemini-agent.md
├── commands/
│   └── gemini.md
├── scripts/
│   └── gemini-bridge.js
├── skills/
│   └── gemini/
│       ├── SKILL.md
│       └── agents/
│           └── openai.yaml
├── tests/
│   └── gemini-bridge.test.js
└── package.json
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication error | Run `gemini auth` |
| Gemini missing on PATH | Install `@google/gemini-cli` or `brew install gemini-cli` |
| Token pressure | Narrow the inlined scope with fewer directories or more specific globs |
| Timeout | Reduce the context set and tighten the task |

## License

MIT
