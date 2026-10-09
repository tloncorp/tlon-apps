import { describe, expect, it } from 'vitest';

import {
  engineSignal,
  readSchemaVersion,
  satisfiesRange,
  schemaSignal,
  subpathSignal,
  truncateDiff,
  zodHint,
} from './signals.ts';

describe('hard signals', () => {
  it('sdkSubpathRemoved fires only for removed-in-next', () => {
    const signal = subpathSignal(
      [
        { subpath: 'plugin-sdk/core', class: 'present-both' },
        { subpath: 'plugin-sdk/gone', class: 'removed-in-next' },
        { subpath: 'plugin-sdk', class: 'absent-in-both' },
      ],
      '2026.9.4',
      '2026.9.8'
    );
    expect(signal).toEqual({
      fired: true,
      evidence: [
        'openclaw/plugin-sdk/gone is exported at 2026.9.4 but not at 2026.9.8',
      ],
    });
    expect(
      subpathSignal(
        [{ subpath: 'plugin-sdk', class: 'absent-in-both' }],
        'a',
        'b'
      ).fired
    ).toBe(false);
  });

  it('engineChanged reports both ranges and whether the canary Node satisfies the new one', () => {
    const range = '>=24.16.0 <25 || >=26.1.0';
    expect(engineSignal(range, range, '24.16.0')).toMatchObject({
      fired: false,
      evidence: [],
      canarySatisfies: true,
    });
    expect(engineSignal('>=22.12.0', range, '24.16.0')).toEqual({
      fired: true,
      evidence: [`engines.node >=22.12.0 → ${range}`],
      prev: '>=22.12.0',
      next: range,
      canarySatisfies: true,
    });
    expect(engineSignal(range, '>=26.1.0', '24.16.0')).toMatchObject({
      fired: true,
      canarySatisfies: false,
    });
  });

  it('stateSchemaBumped compares OPENCLAW_STATE_SCHEMA_VERSION at both ends', () => {
    const prev = readSchemaVersion(
      'export const OPENCLAW_STATE_SCHEMA_VERSION = 17;\nexport const OPENCLAW_STATE_STRICT_SCHEMA_VERSION = 3;'
    );
    const next = readSchemaVersion(
      'export const OPENCLAW_STATE_SCHEMA_VERSION = 19;'
    );
    expect(schemaSignal(prev, next)).toMatchObject({
      fired: true,
      prev: 17,
      next: 19,
    });
    expect(schemaSignal(19, 19).fired).toBe(false);
    // unreadable is reported as incomplete by the digest, not as a bump
    expect(schemaSignal(undefined, 19).fired).toBe(false);
  });
});

const zodDiff = [
  'diff --git a/src/config/zod-schema.ts b/src/config/zod-schema.ts',
  '--- a/src/config/zod-schema.ts',
  '+++ b/src/config/zod-schema.ts',
  '@@ -1,4 +1,4 @@',
  '-    ownerAllowFrom: z.array(z.string()).optional(),',
  '+    ownerAllowFrom: z.array(OwnerSchema).optional(),',
  '-    // memory is described elsewhere',
  'diff --git a/src/other.ts b/src/other.ts',
  '-    ownerAllowFrom: z.array(z.string()).optional(),',
].join('\n');

describe('configKeyInZodDiff', () => {
  it('fires on a removed zod line defining a config key, even with a + counterpart', () => {
    const hint = zodHint(zodDiff, ['commands.ownerAllowFrom', 'memory']);
    expect(hint.fired).toBe(true);
    expect(hint.evidence).toEqual([
      'commands.ownerAllowFrom: src/config/zod-schema.ts: ownerAllowFrom: z.array(z.string()).optional(),',
    ]);
  });

  it('stays quiet when no zod line defining our keys is removed', () => {
    expect(zodHint(zodDiff, ['cron']).fired).toBe(false);
  });
});

describe('truncateDiff', () => {
  const file = (name: string, lines: number) =>
    [
      `diff --git a/${name} b/${name}`,
      ...Array.from({ length: lines }, (_, i) => `+line ${i}`),
    ].join('\n');

  it('caps each file and the total, saying what it left out', () => {
    const out = truncateDiff(
      [file('a.ts', 10), file('b.ts', 3), file('c.ts', 50)].join('\n'),
      {
        perFile: 5,
        total: 12,
      }
    ).split('\n');
    expect(out).toContain('… 6 lines omitted');
    expect(out).toContain('diff --git a/b.ts b/b.ts');
    expect(out.at(-2)).toBe(
      '… 1 more files (51 lines) omitted; see upstream-diff-files.txt'
    );
    expect(out.length - 1).toBeLessThanOrEqual(12);
  });
});

describe('satisfiesRange', () => {
  it('reads the comparator forms engines.node uses', () => {
    const range = '>=24.16.0 <25 || >=26.1.0';
    expect(satisfiesRange('24.16.0', range)).toBe(true);
    expect(satisfiesRange('24.15.9', range)).toBe(false);
    expect(satisfiesRange('25.0.0', range)).toBe(false);
    expect(satisfiesRange('26.1.0', range)).toBe(true);
    expect(satisfiesRange('22.22.0', '^22.12.0')).toBe(true);
    expect(satisfiesRange('24.16.0', '^22.12.0')).toBe(false);
    expect(satisfiesRange('24.16.0', '24.x')).toBe(true);
    expect(satisfiesRange('24.16.0', 'lts/*')).toBeUndefined();
  });

  it('expands partial bounds the way node-semver does', () => {
    const node = '24.16.0';
    expect(satisfiesRange(node, '>24')).toBe(false);
    expect(satisfiesRange(node, '<=24')).toBe(true);
    expect(satisfiesRange(node, '>=24')).toBe(true);
    expect(satisfiesRange(node, '<24')).toBe(false);
    expect(satisfiesRange(node, '>24.1')).toBe(true);
    expect(satisfiesRange(node, '<=24.16')).toBe(true);
    expect(satisfiesRange(node, '<=24.15')).toBe(false);
    expect(satisfiesRange(node, '=24')).toBe(true);
    expect(satisfiesRange(node, '24')).toBe(true);
    expect(satisfiesRange('25.0.0', '=24')).toBe(false);
    expect(satisfiesRange(node, '>=24.16.0 <25 || >=26.1.0')).toBe(true);
    expect(
      satisfiesRange(node, '>=22.22.3 <23 || >=24.15.0 <25 || >=25.9.0')
    ).toBe(true);
  });
});
