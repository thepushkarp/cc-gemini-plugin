# cc-gemini-plugin

Dual-host Gemini CLI integration for Claude Code and Codex.

This repository uses one shared Gemini runtime and two thin host adapters:
- Claude Code exposes `/cc-gemini-plugin:gemini` and `gemini-agent`.
- Codex exposes the bundled `gemini-integration` skill.

It gives each host a clean way to hand large, cross-file analysis tasks to
Gemini instead of solving everything file-by-file.

## Architecture

- Shared bridge runtime at `scripts/gemini-bridge.js`
- Claude Code integration through the plugin manifest, `/cc-gemini-plugin:gemini`
  command, and `gemini-agent`
- Codex integration through the root `SKILL.md` skill definition and
  `agents/openai.yaml`
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

This is a user-level install. Once you add the marketplace and install the
plugin, it stays available in new Claude Code sessions on this machine.

Add the marketplace from GitHub, install the plugin, then reload plugins:

```bash
/plugin marketplace add thepushkarp/cc-gemini-plugin
/plugin install cc-gemini-plugin@cc-gemini-plugin
/reload-plugins
```

After installation, use:

```bash
/cc-gemini-plugin:gemini <task>
```

After pulling marketplace changes, refresh the catalog and reload the plugin:

```bash
/plugin marketplace update cc-gemini-plugin
/reload-plugins
```

### Codex

Codex does not need a plugin for this repository. Install it as a user-level
skill so it is available in new Codex sessions on this machine across
repositories.

Install it by cloning the repository into `~/.agents/skills`:

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/thepushkarp/cc-gemini-plugin.git \
  ~/.agents/skills/cc-gemini-plugin
```

Restart Codex after cloning the skill.

To update it later:

```bash
git -C ~/.agents/skills/cc-gemini-plugin pull
```

After installation, use the bundled skill:

```text
$gemini-integration
```

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
/cc-gemini-plugin:gemini <task>
/cc-gemini-plugin:gemini --dirs src,docs <task>
/cc-gemini-plugin:gemini --files "schemas/**/*.json,data/**/*.csv" <task>
```

### Codex

Use the bundled skill:

```text
$gemini-integration
```

Or ask Codex to use the Gemini integration for a large-context pass.

Codex-specific skill metadata lives in `agents/openai.yaml`.

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
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── SKILL.md
├── agents/
│   ├── gemini-agent.md
│   └── openai.yaml
├── commands/
│   └── gemini.md
├── scripts/
│   └── gemini-bridge.js
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
