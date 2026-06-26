import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guards the TLON-6042 notes-API refactor: %notes v1 protocol details live in
// @tloncorp/api, and skill cleanup paths use the explicit delete helpers. These
// are the durable form of the plan's `rg` review gates.

const scriptsDir = join(process.cwd(), 'scripts');

function skillSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return skillSourceFiles(fullPath);
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) {
      return [];
    }
    return [fullPath];
  });
}

const files = skillSourceFiles(scriptsDir).map((path) => ({
  path: path.replace(`${scriptsDir}/`, ''),
  source: readFileSync(path, 'utf-8'),
}));

describe('notes refactor boundaries', () => {
  it('no skill source builds raw /notes/~/v1 paths or calls notes v1 requestJson', () => {
    for (const { path, source } of files) {
      expect(source, `${path} should not build /notes/~/v1 paths`).not.toMatch(
        /\/notes\/~\/v1/
      );
      expect(source, `${path} should not call requestJson`).not.toMatch(
        /\brequestJson\s*\(/
      );
    }
  });

  it('no skill source pokes %notes directly (actions go through @tloncorp/api)', () => {
    for (const { path, source } of files) {
      expect(source, `${path} should not poke app: 'notes'`).not.toMatch(
        /app:\s*['"]notes['"]/
      );
      expect(
        source,
        `${path} should not use the notes-action mark`
      ).not.toMatch(/mark:\s*['"]notes-action['"]/);
    }
  });

  it('skill cleanup paths use explicit strict/best-effort delete, not the ambiguous top-level helper', () => {
    for (const { path, source } of files) {
      if (!/from\s+['"]@tloncorp\/api['"]/.test(source)) {
        continue;
      }
      // `\bdeleteNotesNotebook\b` matches only the bare name — the `Strict` /
      // `BestEffort` suffixes break the trailing word boundary.
      expect(
        source,
        `${path} should import deleteNotesNotebookStrict/BestEffort, not bare deleteNotesNotebook`
      ).not.toMatch(/\bdeleteNotesNotebook\b/);
    }
  });
});
