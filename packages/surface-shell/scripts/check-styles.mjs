#!/usr/bin/env node
/**
 * No hardcoded colors or font families anywhere in shell source: styles
 * must come from the generated token variables (`var(--…)`). The generated
 * tokens.css is the one place literal values live.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(fileURLToPath(import.meta.url), '..', '..');
const srcRoot = join(packageRoot, 'src');
const EXEMPT = ['tokens/tokens.css'];

// The whitespace lives inside the lookaheads: a consumable \s* before a
// negative lookahead can backtrack to zero and defeat it.
const RULES = [
  { name: 'hex color literal', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb()/rgba() literal', pattern: /\brgba?\s*\(/ },
  { name: 'hsl()/hsla() literal', pattern: /\bhsla?\s*\(/ },
  {
    name: 'font-family literal',
    pattern: /font-family\s*:(?!\s*var\(--)/,
  },
  {
    name: 'named color in a style value',
    // catches `color: red` declarations; CSS only — in TSX, style values
    // are JS expressions and property names would false-positive
    cssOnly: true,
    pattern:
      /(?:^|;|\{)\s*(?:background|background-color|color|border-color|outline-color|fill|stroke)\s*:(?!\s*(?:var\(--|transparent|inherit|currentColor|none))/m,
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (/\.(ts|tsx|css)$/.test(name)) {
      yield path;
    }
  }
}

const violations = [];
for (const file of walk(srcRoot)) {
  const relativePath = relative(srcRoot, file).replaceAll('\\', '/');
  if (EXEMPT.includes(relativePath)) {
    continue;
  }
  const source = readFileSync(file, 'utf8');
  for (const rule of RULES) {
    if (rule.cssOnly && !file.endsWith('.css')) {
      continue;
    }
    const match = source.match(rule.pattern);
    if (match) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(
        `${relativePath}:${line}: ${rule.name} (${match[0].trim()})`
      );
    }
  }
}

if (violations.length > 0) {
  console.error('surface-shell style check failed (tokens only):');
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
console.log('surface-shell style check passed');
