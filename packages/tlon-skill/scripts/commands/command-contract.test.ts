import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const commandsDir = join(process.cwd(), 'scripts', 'commands');

function commandSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return commandSourceFiles(fullPath);
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return [];
    return [fullPath];
  });
}

const forbiddenPatterns = [
  { name: 'process.exit', pattern: /\bprocess\.exit\b/ },
  { name: 'process.argv', pattern: /\bprocess\.argv\b/ },
  { name: 'process.env', pattern: /\bprocess\.env\b/ },
  { name: 'process.stdin', pattern: /\bprocess\.stdin\b/ },
  {
    name: 'console writes',
    pattern: /\bconsole\.(log|error|warn|info|debug)\b/,
  },
  { name: 'fs imports', pattern: /from\s+["'](?:node:)?fs(?:\/promises)?["']/ },
  { name: 'os imports', pattern: /from\s+["'](?:node:)?os["']/ },
  { name: 'homedir usage', pattern: /\bhomedir\s*\(/ },
  { name: 'global fetch calls', pattern: /(^|[^.\w])fetch\s*\(/ },
  { name: 'Blob construction', pattern: /\bnew\s+Blob\b/ },
  {
    name: 'exit helper imports',
    pattern: /\bprint(?:Help|Usage|Error)AndExit\b/,
  },
  {
    name: 'raw API value imports',
    pattern:
      /import\s+(?!type\b)[^;]*from\s+["']@tloncorp\/api(?:\/[^"']*)?["']/,
  },
  {
    name: 'raw API side-effect imports',
    pattern: /import\s+["']@tloncorp\/api(?:\/[^"']*)?["']/,
  },
];

describe('migrated command source contract', () => {
  for (const filePath of commandSourceFiles(commandsDir)) {
    it(`${filePath.replace(`${process.cwd()}/`, '')} avoids adapter-only globals`, () => {
      const source = readFileSync(filePath, 'utf-8');

      for (const forbidden of forbiddenPatterns) {
        expect(source, forbidden.name).not.toMatch(forbidden.pattern);
      }
    });
  }
});
