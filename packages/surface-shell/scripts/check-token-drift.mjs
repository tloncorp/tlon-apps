#!/usr/bin/env node
// CI drift check: the committed tokens.css must match a fresh regeneration
// from @tloncorp/ui's Tamagui config.
import { readFileSync } from 'node:fs';

import { TOKENS_CSS_PATH, generateTokensCss } from './token-codegen.mjs';

const expected = await generateTokensCss();
let committed = null;
try {
  committed = readFileSync(TOKENS_CSS_PATH, 'utf8');
} catch {
  // fall through to the failure below
}

if (committed !== expected) {
  console.error(
    'surface-shell token drift: src/tokens/tokens.css is stale relative to'
  );
  console.error(
    "@tloncorp/ui's tamagui.config.ts. Run `pnpm generate:tokens` and commit."
  );
  process.exit(1);
}
console.log('surface-shell token drift check passed');
