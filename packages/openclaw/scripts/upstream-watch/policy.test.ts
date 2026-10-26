import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { type LabeledRow, classifyRows, oursOf } from './policy.ts';

// Probe output from 2026-10-08 with the final question set: one row per
// curated bullet of 9.7 and 9.8, before dedupe, bullets cut to 220 chars.
const rows = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as LabeledRow);

// The plugin's imports when the probe ran, including the three subpaths
// that were absent upstream.
const IMPORTED = [
  'core',
  'types',
  'runtime',
  'runtime-env',
  'routing',
  'setup',
  'conversation-runtime',
  'config-runtime',
  'channel-entry-contract',
  'channel-contract',
  'status-helpers',
  'state-paths',
  'runtime-store',
  'response-limit-runtime',
  'reply-payload',
  'reply-chunking',
  'plugin-state-runtime',
  'param-readers',
  'media-mime',
  'lazy-runtime',
  'inbound-reply-dispatch',
  'diagnostic-runtime',
  'channel-config-helpers',
  'account-helpers',
  'ssrf-runtime',
  'channel-runtime',
  'outbound-runtime',
]
  .map((name) => `plugin-sdk/${name}`)
  .concat('plugin-sdk');

const counts = (sections: ReturnType<typeof classifyRows>) => ({
  deprecations: sections.deprecations.length,
  check: sections.check.length,
  changes: sections.changes.length,
  relevant: sections.relevant.length,
  dropped: sections.dropped.length,
});

describe('policy golden', () => {
  it('9.7: one deprecation for us, by subject only', () => {
    const sections = classifyRows(rows('r2-9.7.jsonl'), IMPORTED);
    expect(counts(sections)).toEqual({
      deprecations: 1,
      // 5 under whole-bullet matching; the facades bullet that names
      // plugin-sdk/core only as its replacement is now a check: line
      check: 6,
      // 7 behavior_default_change, plus the CLI root-options bullet on its
      // breaking label alone (0.81, ours 0.78)
      changes: 8,
      relevant: 179,
      dropped: 122,
    });
    expect(
      sections.changes
        .filter((c) => c.breaking)
        .map(({ row }) => row.bullet.slice(0, 33))
    ).toEqual(['CLI: reject unknown root options ']);
    expect(sections.labeled).toBe(316);
    expect(sections.deprecations[0].names).toEqual([
      'plugin-sdk/config-runtime',
    ]);
    expect(sections.deprecations[0].row.bullet).toMatch(
      /^\*\*`openclaw\/plugin-sdk\/config-runtime`:\*\*/
    );
    expect(
      sections.check.some(({ row }) =>
        row.bullet.startsWith('**Public media-understanding')
      )
    ).toBe(true);
  });

  it('9.8: nothing above relevant', () => {
    expect(counts(classifyRows(rows('r2-9.8.jsonl'), IMPORTED))).toEqual({
      deprecations: 0,
      check: 0,
      changes: 0,
      relevant: 9,
      dropped: 4,
    });
  });

  it('a minimal import set still finds the config-runtime deprecation', () => {
    const sections = classifyRows(rows('r2-9.7.jsonl'), [
      'plugin-sdk/config-runtime',
      'plugin-sdk/core',
    ]);
    expect(sections.deprecations).toHaveLength(1);
    expect(sections.check).toHaveLength(6);
  });
});

const row = (
  area_probs: Record<string, number>,
  kind_probs: Record<string, number>,
  extra: Partial<LabeledRow> = {}
): LabeledRow => ({
  section: 'Fixes',
  bullet: 'Thing: did a thing (#1)',
  area: Object.keys(area_probs)[0],
  area_probs,
  kind: Object.keys(kind_probs)[0],
  kind_probs,
  affects: 0.5,
  ...extra,
});

describe('policy rules', () => {
  it('sums area probabilities over our subsystems', () => {
    expect(
      oursOf(
        row(
          { plugin_sdk: 0.45, config_doctor_update: 0.4, client_ui: 0.15 },
          {}
        )
      )
    ).toBeCloseTo(0.85);
  });

  it('sums fix, new_capability and internal_or_docs for relevant', () => {
    const split = row(
      { gateway_runtime: 1 },
      { fix: 0.5, internal_or_docs: 0.4, breaking: 0.1 }
    );
    expect(classifyRows([split], []).relevant).toHaveLength(1);
    const low = row({ gateway_runtime: 1 }, { fix: 0.5, breaking: 0.5 });
    expect(classifyRows([low], []).dropped).toHaveLength(1);
  });

  it('puts a breaking label for us under changes, flagged, never breaks-us', () => {
    const breaking = row(
      { gateway_runtime: 0.8 },
      { breaking: 0.75, fix: 0.25 }
    );
    const sections = classifyRows([breaking], []);
    expect(sections.changes).toEqual([
      { row: breaking, ours: 0.8, breaking: true },
    ]);
    expect(sections.dropped).toHaveLength(0);
    const notOurs = row({ other_channel: 0.8 }, { breaking: 0.9 });
    expect(classifyRows([notOurs], []).dropped).toHaveLength(1);
    // the deprecation rules still come first
    const deprecated = row(
      { plugin_sdk: 1 },
      { deprecation_notice: 0.8, breaking: 0.8 }
    );
    expect(classifyRows([deprecated], []).check).toHaveLength(1);
    const unflagged = row({ plugin_sdk: 1 }, { behavior_default_change: 0.9 });
    expect(classifyRows([unflagged], []).changes[0].breaking).toBeUndefined();
  });

  it('never classifies an unlabeled row, and counts it against coverage', () => {
    const sections = classifyRows(
      [{ section: 'Fixes', bullet: 'x', labeled: false, reason: 'timeout' }],
      []
    );
    expect(sections).toMatchObject({ labeled: 0, total: 1 });
    expect(sections.dropped).toHaveLength(1);
  });

  it('lists a workaround at addresses >= 0.8 only', () => {
    const sections = classifyRows(
      [
        row(
          { gateway_runtime: 1 },
          { fix: 1 },
          { addresses: { patch: 0.86, strip: 0.79 } }
        ),
      ],
      []
    );
    expect(sections.mayFix.map((m) => [m.workaround, m.p])).toEqual([
      ['patch', 0.86],
    ]);
  });
});
