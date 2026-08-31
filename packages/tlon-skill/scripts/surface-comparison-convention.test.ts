import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CANONICAL_HELPER_FILE,
  checkComparisonConvention,
  formatViolations,
  packageRoot,
  scanSourceForComparisonViolations,
  surfaceSourceFiles,
} from './surface-comparison-convention';

/**
 * Two halves, and both are needed.
 *
 * The second half — "the surface sources hold no violations" — is the gate. On
 * its own it is worthless: a scanner that matched nothing, or a file list that
 * globbed nothing, would pass it just as green. So the first half proves the
 * matching power independently, on fixtures small enough to read, and the file
 * list is asserted to contain named files rather than merely to be non-empty.
 */

const OTHER = 'scripts/somewhere-else.ts';

describe('the convention check can fail', () => {
  it('catches deep equality written as a pair of JSON.stringify calls', () => {
    const found = scanSourceForComparisonViolations(
      'const same = JSON.stringify(written) === JSON.stringify(readBack);',
      OTHER
    );
    expect(found).toHaveLength(1);
    expect(found[0].rule).toBe('serialized-comparison');
    expect(found[0].line).toBe(1);
  });

  it('catches it through parentheses and a TypeScript cast', () => {
    const found = scanSourceForComparisonViolations(
      'if ((JSON.stringify(a) as string) !== JSON.stringify(b)) throw 1;',
      OTHER
    );
    expect(found).toHaveLength(1);
    expect(found[0].rule).toBe('serialized-comparison');
  });

  it('catches a call to a structural-equality helper, bare or as a member', () => {
    expect(
      scanSourceForComparisonViolations('const x = isEqual(a, b);', OTHER)[0]
        .rule
    ).toBe('ad-hoc-deep-equality');
    expect(
      scanSourceForComparisonViolations('const x = _.isEqual(a, b);', OTHER)[0]
        .rule
    ).toBe('ad-hoc-deep-equality');
    expect(
      scanSourceForComparisonViolations(
        'const x = deepEqualJson(spec, readBack);',
        OTHER
      )[0].rule
    ).toBe('ad-hoc-deep-equality');
  });

  it('catches the import that would bring one in', () => {
    const found = scanSourceForComparisonViolations(
      "import { isEqual } from 'lodash';\n",
      OTHER
    );
    expect(found.map((violation) => violation.rule)).toEqual([
      'ad-hoc-deep-equality',
    ]);
    const byModule = scanSourceForComparisonViolations(
      "import equal from 'fast-deep-equal';\n",
      OTHER
    );
    expect(byModule.map((violation) => violation.rule)).toEqual([
      'ad-hoc-deep-equality',
    ]);
  });

  it('catches a second definition of the canonical helper', () => {
    const declared = scanSourceForComparisonViolations(
      'function canonicalJson(value: unknown): string { return ""; }',
      OTHER
    );
    expect(declared).toHaveLength(1);
    expect(declared[0].rule).toBe('duplicate-canonical-helper');

    const assigned = scanSourceForComparisonViolations(
      'const stableStringify = (value: unknown) => "";',
      OTHER
    );
    expect(assigned).toHaveLength(1);
    expect(assigned[0].rule).toBe('duplicate-canonical-helper');
  });

  it('reports the line, and prints a line a human can act on', () => {
    const found = scanSourceForComparisonViolations(
      ['const a = 1;', '', 'const same = isEqual(x, y);'].join('\n'),
      'scripts/surface-example.ts'
    );
    expect(found[0].line).toBe(3);
    expect(formatViolations(found)).toContain(
      'scripts/surface-example.ts:3:14'
    );
    expect(formatViolations(found)).toContain('const same = isEqual(x, y);');
  });
});

describe('the convention check does not cry wolf', () => {
  it('accepts the comparison the convention asks for', () => {
    expect(
      scanSourceForComparisonViolations(
        'const changed = canonicalJson(written) !== canonicalJson(readBack);',
        OTHER
      )
    ).toEqual([]);
  });

  it('accepts JSON.stringify used to serialize rather than to compare', () => {
    expect(
      scanSourceForComparisonViolations(
        'const blob = JSON.stringify([entry]);\nconst n = blob.length === 0;',
        OTHER
      )
    ).toEqual([]);
  });

  it('exempts only the canonical module from the duplicate rule', () => {
    const source = 'export function canonicalJson(v: unknown) { return ""; }';
    expect(
      scanSourceForComparisonViolations(source, CANONICAL_HELPER_FILE)
    ).toEqual([]);
    expect(scanSourceForComparisonViolations(source, OTHER)).not.toEqual([]);
  });
});

describe('scope', () => {
  const files = surfaceSourceFiles();

  it('resolves the package root without depending on the cwd', () => {
    // `packageRoot()` is derived from this module's own location, so a runner
    // that starts somewhere else still scans the right tree — and if that
    // derivation ever breaks, it breaks HERE, loudly, instead of quietly
    // returning an empty file list that every other assertion would pass.
    const manifest = JSON.parse(
      readFileSync(join(packageRoot(), 'package.json'), 'utf8')
    ) as { name?: string };
    expect(manifest.name).toBe('@tloncorp/tlon-skill');
  });

  it('covers the surface sources by naming convention, not by a list', () => {
    // Named files, not just a count: a glob that silently stopped matching
    // would leave a passing test behind, which is the failure this whole check
    // exists to prevent one level up.
    expect(files).toContain('scripts/surface-lint.ts');
    expect(files).toContain('scripts/surface-preview.ts');
    expect(files).toContain('scripts/commands/surface-publish.ts');
    expect(files).toContain('scripts/commands/surface-common.ts');
    expect(files).toContain(CANONICAL_HELPER_FILE);
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it('leaves test files out', () => {
    expect(files.filter((file) => file.endsWith('.test.ts'))).toEqual([]);
  });

  it('stays inside this package', () => {
    // `packages/api`'s `deepEqualJson` compares channelContentConfiguration and
    // `packages/app`'s `stableStringify` compares bot-settings drafts. Neither
    // is a surface spec; both would be false positives, and a false positive is
    // how a convention check gets suppressed instead of followed.
    expect(files.every((file) => file.startsWith('scripts/'))).toBe(true);
  });
});

describe('the surface sources follow the convention', () => {
  it('holds no ad-hoc comparison of surface JSON', () => {
    const violations = checkComparisonConvention();
    expect(formatViolations(violations)).toBe('');
    expect(violations).toEqual([]);
  });
});
