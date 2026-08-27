#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

import { TOKENS_CSS_PATH, generateTokensCss } from './token-codegen.mjs';

const css = await generateTokensCss();
writeFileSync(TOKENS_CSS_PATH, css);
console.log(`wrote ${TOKENS_CSS_PATH}`);
