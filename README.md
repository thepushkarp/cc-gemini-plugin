# cc-gemini-plugin

Dual-host Gemini CLI integration for Claude Code and Codex.

The plugin uses one shared Gemini runtime and two thin host adapters:
- Claude Code exposes `/gemini` and `gemini-agent`.
- Codex exposes the bundled `gemini-integration` skill and plugin manifest.

The plugin gives the host a clean way to hand large, cross-file analysis tasks
to Gemini instead of solving everything file-by-file.

## Architecture

- Shared bridge runtime at `scripts/gemini-bridge.js`
- Claude Code integration through the plugin manifest, `/gemini` command, and `gemini-agent`
- Codex integration through `.codex-plugin/plugin.json`, the shared skill, and marketplace
  metadata
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

Add the marketplace from GitHub, install the plugin, then reload plugins:

```bash
/plugin marketplace add thepushkarp/cc-gemini-plugin
/plugin install cc-gemini-plugin@cc-gemini-plugin
/reload-plugins
```

After installation, use:

```bash
/gemini <task>
```

After pulling marketplace changes, refresh the catalog and reload the plugin:

```bash
/plugin marketplace update cc-gemini-plugin
/reload-plugins
```

If you want collaborators to discover the marketplace automatically when they
trust the repository, add it to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "cc-gemini-plugin": {
      "source": {
        "source": "github",
        "repo": "thepushkarp/cc-gemini-plugin"
      }
    }
  }
}
```

For local development, you can add a filesystem path instead of the GitHub
repository:

```bash
/plugin marketplace add /absolute/path/to/cc-gemini-plugin
/plugin install cc-gemini-plugin@cc-gemini-plugin
/reload-plugins
```

### Codex

The easiest personal install is to keep the plugin in
`~/.codex/plugins/cc-gemini-plugin` and point one personal marketplace entry at
it.

Clone the plugin into your personal Codex plugins directory:

```bash
mkdir -p ~/.codex/plugins ~/.agents/plugins
git clone https://github.com/thepushkarp/cc-gemini-plugin.git \
  ~/.codex/plugins/cc-gemini-plugin
```

Create `~/.agents/plugins/marketplace.json` with:

```json
{
  "name": "personal-plugins",
  "interface": {
    "displayName": "Personal Plugins"
  },
  "plugins": [
    {
      "name": "cc-gemini-plugin",
      "source": {
        "source": "local",
        "path": "./.codex/plugins/cc-gemini-plugin"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

If you already have `~/.agents/plugins/marketplace.json`, add the
`cc-gemini-plugin` object to its `plugins` array instead of replacing the file.

Restart Codex after editing the marketplace file or updating the plugin
directory.

After installation, use the bundled skill:

```text
$gemini-integration
```

For local development, the repository also includes `.codex-plugin/plugin.json`
and `.agents/plugins/marketplace.json`, so a clone can act as a self-contained
local plugin checkout. Restart Codex after marketplace changes so it reloads the
local marketplace.

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
