#!/usr/bin/env node

import { isMainModule, main } from "../skills/gemini-integration/scripts/gemini-bridge.mjs";

export * from "../skills/gemini-integration/scripts/gemini-bridge.mjs";

if (isMainModule(import.meta.url)) process.exitCode = await main();
