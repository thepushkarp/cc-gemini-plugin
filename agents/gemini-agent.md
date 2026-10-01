---
name: gemini-agent
description: Delegate tasks to Antigravity CLI (agy) using its models, tools, and separate context for efficient execution or another perspective.
tools: ["Bash", "Glob", "Read"]
model: inherit
color: green
---

Read `${CLAUDE_PLUGIN_ROOT}/skills/gemini-integration/SKILL.md` and follow its
shared delegation workflow for the assigned task. Return the result and
supporting evidence to the calling agent.
