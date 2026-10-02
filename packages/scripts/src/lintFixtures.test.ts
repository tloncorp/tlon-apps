import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// Runs the tlon oxlint plugin over oxlint/fixtures/no-raw-desk-request. The
// plugin decides scope and import zones from a file's repo-relative path, so
// the fixtures are laid out as the tree they stand for (packages/app/...,
// apps/tlon-web/src/...) and copied, with the plugin, into a scratch root.
// Each fixture's first line names the rules it must trip, or `none`.

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const FIXTURES = path.join(REPO_ROOT, 'oxlint/fixtures/no-raw-desk-request');
const RULES = ['tlon/no-raw-desk-request', 'tlon/restricted-paths'];

type Diagnostic = { code: string; filename: string; message: string };

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function expectation(file: string) {
  const first = readFileSync(file, 'utf8').split('\n', 1)[0];
  const match = /^\/\/ expect: (\S+(?:, \S+)*)$/.exec(first);
  if (!match) {
    throw new Error(`${file} does not start with // expect: <rules|none>`);
  }
  return match[1].split(', ').sort().join(', ');
}

// `tlon(no-raw-desk-request)` -> `tlon/no-raw-desk-request`
const ruleOf = (code: string) => code.replace(/^(\w+)\((.+)\)$/, '$1/$2');

let root: string;
let byFile: Map<string, string[]>;

beforeAll(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), 'lint-fixtures-')));
  mkdirSync(path.join(root, 'oxlint'));
  for (const name of ['tlon-plugin.cjs', 'desk-request-scope.json']) {
    cpSync(
      path.join(REPO_ROOT, 'oxlint', name),
      path.join(root, 'oxlint', name)
    );
  }
  cpSync(FIXTURES, root, { recursive: true });
  writeFileSync(
    path.join(root, '.oxlintrc.json'),
    JSON.stringify({
      jsPlugins: ['./oxlint/tlon-plugin.cjs'],
      rules: Object.fromEntries(RULES.map((rule) => [rule, 'error'])),
    })
  );
  const result = spawnSync(
    path.join(REPO_ROOT, 'node_modules/.bin/oxlint'),
    ['-c', '.oxlintrc.json', '-f', 'json', '.'],
    { cwd: root, encoding: 'utf8' }
  );
  if (result.error) {
    throw result.error;
  }
  const diagnostics: Diagnostic[] = JSON.parse(result.stdout).diagnostics;
  byFile = new Map();
  for (const d of diagnostics) {
    const rule = ruleOf(d.code);
    if (!RULES.includes(rule)) {
      continue;
    }
    const rel = path.relative(root, path.resolve(root, d.filename));
    byFile.set(rel, [...(byFile.get(rel) ?? []), rule]);
  }
}, 60_000);

afterAll(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true });
  }
});

const fixtures = listFiles(FIXTURES).map((file) => ({
  rel: path.relative(FIXTURES, file),
  expected: expectation(file),
}));

describe('no-raw-desk-request fixtures', () => {
  test('the suite covers both rules and clean files', () => {
    const kinds = new Set(fixtures.flatMap((f) => f.expected.split(', ')));
    expect([...kinds].sort()).toEqual(['none', ...RULES].sort());
  });

  test.each(fixtures)('$rel -> $expected', ({ rel, expected }) => {
    const reported = byFile.get(rel) ?? [];
    if (expected === 'none') {
      expect(reported).toEqual([]);
    } else {
      expect(reported.length).toBeGreaterThan(0);
      expect([...new Set(reported)].sort().join(', ')).toEqual(expected);
    }
  });
});
