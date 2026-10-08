import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../../scripts/command-catalog.json';
import { formatCommandIndex } from '../../scripts/top-level-commands';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('installed skill contract', () => {
  it('routes every command to a reachable task reference', () => {
    const skill = read('SKILL.md');
    for (const [name, entry] of Object.entries(catalog)) {
      expect(formatCommandIndex()).toContain(name);
      expect(formatCommandIndex()).toContain(entry.summary);
      expect(skill).toContain(`(${entry.reference})`);
      expect(existsSync(resolve(root, entry.reference))).toBe(true);
    }
  });
  it('keeps local links and model examples usable', () => {
    const files = [
      'SKILL.md',
      ...new Set(Object.values(catalog).map((entry) => entry.reference)),
    ];
    for (const file of files) {
      const text = read(file);
      expect(text).not.toMatch(
        /Hermes|plugin-skills\/tlon-skill|\/root\/\.openclaw/i
      );
      for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        if (match[1].includes('://') || match[1].startsWith('#')) continue;
        expect(
          existsSync(resolve(root, dirname(file), match[1].split('#')[0]))
        ).toBe(true);
      }
      for (const block of text.matchAll(/```json\n([\s\S]*?)```/g)) {
        for (const line of block[1].trim().split('\n')) {
          const { command } = JSON.parse(line);
          expect(typeof command).toBe('string');
          expect(command).not.toMatch(/^tlon\s|\$[A-Z_]+|--stdin|\|/);
          expect(['help', ...Object.keys(catalog)]).toContain(
            command.split(' ')[0]
          );
        }
      }
    }
  });
  it('publishes the catalog, references, and operator documentation', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const file of [
      'SKILL.md',
      'references/',
      'scripts/command-catalog.json',
      'operator-guide.md',
    ])
      expect(pkg.files).toContain(file);
  });
});
