import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { DigestInput } from './digest.ts';
import type { LabeledRow } from './policy.ts';
import {
  type CanaryReports,
  MAX_BODY_BYTES,
  MAX_LINES,
  MAX_LINE_CHARS,
  bodyBytes,
  readCanaryReports,
  renderPost,
  selectDigestArtifact,
} from './render.ts';

const quiet = { fired: false, evidence: [] };

function digest(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    prev: '2026.9.4',
    next: '2026.9.7',
    intermediates: ['2026.9.5', '2026.9.6'],
    publishedAt: '2026-09-29T12:00:00Z',
    lineChange: false,
    bullets: [
      {
        release: '2026.9.7',
        section: 'Highlights',
        text: '**Update safety:** back up state DBs. (#158163)',
        prs: [158163],
      },
      {
        release: '2026.9.7',
        section: 'Fixes',
        text: 'Gateway: fixed. (#2)',
        prs: [2],
      },
    ],
    bulletsBeforeDedupe: 2,
    subpaths: [
      { subpath: 'plugin-sdk/config-runtime', class: 'present-both' },
      { subpath: 'plugin-sdk/channel-runtime', class: 'absent-in-both' },
    ],
    unresolvedToReport: ['plugin-sdk/channel-runtime'],
    signals: {
      sdkSubpathRemoved: quiet,
      engineChanged: { ...quiet, canarySatisfies: true },
      stateSchemaBumped: {
        fired: true,
        evidence: [
          'OPENCLAW_STATE_SCHEMA_VERSION 17 → 19 (one-way migration; rollback needs a state backup)',
        ],
        prev: 17,
        next: 19,
      },
    },
    hints: { configKeyInZodDiff: quiet },
    drift: {
      prodPins: {
        default: '2026.7.1',
        internal: '2026.7.1',
        memorypool: '2026.7.1',
      },
      extendedStable: '2026.8.35',
      releasesBehindOnLine: 7,
      daysBehind: 93,
    },
    incomplete: [],
    missingExtensions: [],
    diffFiles: 3,
    ...overrides,
  };
}

const labeled = (
  bullet: string,
  area_probs: Record<string, number>,
  kind_probs: Record<string, number>,
  extra: Partial<LabeledRow> = {}
): LabeledRow => ({
  section: 'Fixes',
  bullet,
  labeled: true,
  area: Object.keys(area_probs)[0],
  area_probs,
  kind: Object.keys(kind_probs)[0],
  kind_probs,
  affects: 0.5,
  ...extra,
});

const green: CanaryReports = {
  unit: { typecheck: 'pass', unit: 'pass' },
  e2e: {
    baseline: { result: 'pass' },
    cron: { result: 'pass' },
    package: { result: 'pass', coverage: 'partial' },
  },
};

describe('renderPost', () => {
  it('renders the header, sections and footer', () => {
    const rows = [
      labeled(
        '**`openclaw/plugin-sdk/config-runtime`:** use `api.pluginConfig`. (#1)',
        { plugin_sdk: 1 },
        { deprecation_notice: 1 },
        { section: 'Upcoming deprecations' }
      ),
      labeled(
        '**Gateway:** fixed. (#2)',
        { gateway_runtime: 1 },
        { fix: 1 },
        { addresses: { 'ylem-patch': 0.86 } }
      ),
    ];
    const { post, fallback } = renderPost({
      digest: digest(),
      rows,
      canary: { ...green, unit: { typecheck: 'fail', unit: 'pass' } },
      runUrl: 'https://github.com/tloncorp/tlon-apps/actions/runs/1',
      artifactName: 'openclaw-watch-2026.9.7-1',
    });
    expect(fallback).toBe(false);
    expect(post.link).toBe(
      'https://github.com/tloncorp/tlon-apps/actions/runs/1'
    );
    expect(post.lines).toEqual([
      'OpenClaw 2026.9.4 → 2026.9.7 (latest, 9/29; also 9.5, 9.6) — canary 9.7: tsc ✗ unit ✓ e2e ✓ (package: partial) · labeled 2/2',
      'breaks-us',
      '  • tsc fails against 2026.9.7 in the canary',
      'unresolved today',
      '  • openclaw/plugin-sdk/channel-runtime is not exported at 2026.9.4 or 2026.9.7',
      'deprecations-for-us',
      '  • plugin-sdk/config-runtime (we import it) → use `api.pluginConfig`. (#1)',
      'changes-for-us',
      '  • OPENCLAW_STATE_SCHEMA_VERSION 17 → 19 (one-way migration; rollback needs a state backup)',
      'may-fix-workaround',
      '  • ylem-patch ← "Gateway" (#2, 0.86)',
      'relevant: 1 (1 fixes, 0 new; top: Gateway #2)',
      'canary green = plugin fixtures pass on this core, not an upgrade approval',
      'prod: default/internal/memorypool on 2026.7.1 — 9.x line: 7 releases / 93 d behind · extended-stable 2026.8.35',
      'changelog https://github.com/openclaw/openclaw/blob/v2026.9.7/CHANGELOG/2026.9.7.md · diff, labels, dropped: artifact openclaw-watch-2026.9.7-1',
    ]);
  });

  it('reads a missing canary report as infra-error and shows a failed shard', () => {
    const { post } = renderPost({
      digest: digest(),
      rows: [],
      canary: {
        e2e: {
          baseline: { result: 'pass' },
          cron: {
            result: 'fail',
            failedStep: 'e2e',
            errorExcerpt: 'Error: cron did not fire',
          },
        },
      },
    });
    expect(post.lines[0]).toContain(
      'canary 9.7: tsc ? unit ? e2e ✗ (cron: fail, package: infra-error)'
    );
    expect(post.lines).toContain(
      '  • e2e cron: fail at e2e — Error: cron did not fire'
    );
  });

  const prodLineOf = (prodPins: Record<string, string>) => {
    const base = digest();
    const { post } = renderPost({
      digest: { ...base, drift: { ...base.drift, prodPins } },
      rows: [],
      canary: green,
    });
    return post.lines.find((line) => line.startsWith('prod: '));
  };

  it('reads prod pins as unavailable when no bundle has a version', () => {
    expect(prodLineOf({ default: '', internal: '', memorypool: '' })).toMatch(
      /^prod: pins unavailable( |$)/
    );
  });

  it('omits a bundle without a version beside readable ones', () => {
    const line = prodLineOf({
      default: '2026.7.1',
      internal: '',
      memorypool: '2026.7.1',
    });
    expect(line).toMatch(/^prod: default\/memorypool on 2026\.7\.1 — /);
    expect(line).not.toContain('internal');
    expect(line).not.toMatch(/ on (,| —|$)/);
  });

  it('falls back to signals and highlights below half coverage', () => {
    const rows: LabeledRow[] = [
      labeled('**Gateway:** fixed. (#2)', { gateway_runtime: 1 }, { fix: 1 }),
      { section: 'Fixes', bullet: 'x', labeled: false, reason: 'timeout' },
      { section: 'Fixes', bullet: 'y', labeled: false, reason: 'timeout' },
    ];
    const { post, fallback } = renderPost({
      digest: digest({ bullets: digest().bullets.concat(digest().bullets[1]) }),
      rows,
    });
    expect(fallback).toBe(true);
    expect(post.lines[0]).toMatch(/canary 9\.7: pending · labeled 1\/3$/);
    expect(post.lines).toContain('labels unavailable (1/3), highlights');
    expect(post.lines).toContain(
      '  • Update safety: back up state DBs. (#158163)'
    );
    expect(post.lines.some((l) => l.startsWith('relevant:'))).toBe(false);
    // signals survive the fallback
    expect(post.lines).toContain('changes-for-us');
  });

  it('keeps exactly half coverage on the labeled path', () => {
    const rows: LabeledRow[] = [
      labeled('a (#1)', { gateway_runtime: 1 }, { fix: 1 }),
      { section: 'Fixes', bullet: 'b', labeled: false, reason: 'timeout' },
    ];
    expect(renderPost({ digest: digest(), rows }).fallback).toBe(false);
  });

  it('holds 15 lines, 200 characters per line and 4 KB however much there is', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      labeled(
        `**Change ${i}:** ${'é'.repeat(300)} (#${i})`,
        { gateway_runtime: 1 },
        { behavior_default_change: 1 },
        { affects: i / 40 }
      )
    );
    const removed = Array.from(
      { length: 30 },
      (_, i) =>
        `openclaw/plugin-sdk/x${i} is exported at 2026.9.4 but not at 2026.9.7 ${'🦞'.repeat(150)}`
    );
    const { post } = renderPost({
      digest: digest({
        signals: {
          ...digest().signals,
          sdkSubpathRemoved: { fired: true, evidence: removed },
        },
        incomplete: ['changelog missing for 2026.9.5'],
      }),
      rows: many,
      canary: green,
      runUrl: 'https://github.com/tloncorp/tlon-apps/actions/runs/1',
    });
    expect(post.lines.length).toBeLessThanOrEqual(MAX_LINES);
    for (const line of post.lines) {
      expect([...line].length).toBeLessThanOrEqual(MAX_LINE_CHARS);
    }
    expect(bodyBytes(post)).toBeLessThanOrEqual(MAX_BODY_BYTES);
    expect(
      post.lines.some((l) => /^… \+\d+ more in the run artifact$/.test(l))
    ).toBe(true);
    expect(post.lines.at(-3)).toBe(
      'canary green = plugin fixtures pass on this core, not an upgrade approval'
    );
    expect(post.lines[1]).toBe('incomplete: changelog missing for 2026.9.5');
  });

  it('caps deprecations, confirmed first, and counts the rest in the title', () => {
    const confirmed = Array.from({ length: 3 }, (_, i) =>
      labeled(
        `**\`openclaw/plugin-sdk/config-runtime\`:** deprecated ${i}. (#${i})`,
        { plugin_sdk: 1 },
        { deprecation_notice: 1 },
        { section: 'Upcoming deprecations' }
      )
    );
    const checks = Array.from({ length: 2 }, (_, i) =>
      labeled(
        `**Plugin hooks:** old hook ${i} goes away. (#${10 + i})`,
        { plugin_sdk: 1 },
        { deprecation_notice: 1 }
      )
    );
    const { post } = renderPost({
      digest: digest({ unresolvedToReport: [] }),
      rows: [...confirmed, ...checks],
      canary: green,
    });
    const start = post.lines.indexOf(
      'deprecations-for-us (+3 more in the artifact)'
    );
    expect(start).toBeGreaterThan(0);
    const items = post.lines.slice(start + 1, start + 3);
    expect(items).toEqual([
      '  • plugin-sdk/config-runtime (we import it) → deprecated 0. (#0)',
      '  • plugin-sdk/config-runtime (we import it) → deprecated 1. (#1)',
    ]);
    expect(post.lines[start + 3]).not.toMatch(/^ {2}•/);
  });

  it('keeps the canary status and labeled count in a header with many intermediates', () => {
    const intermediates = Array.from(
      { length: 10 },
      (_, i) => `2026.10.${i + 2}`
    );
    const { post } = renderPost({
      digest: digest({
        prev: '2026.10.1',
        next: '2026.10.12',
        lineChange: true,
        intermediates,
      }),
      rows: Array.from({ length: 2 }, () =>
        labeled('a (#1)', { gateway_runtime: 1 }, { fix: 1 })
      ),
      canary: { e2e: {} },
    });
    const header = post.lines[0];
    expect([...header].length).toBeLessThanOrEqual(MAX_LINE_CHARS);
    expect(header).toContain('also 10.2 … 10.11 (10)');
    expect(header).toContain(
      'canary 10.12: tsc ? unit ? e2e ? (baseline: infra-error, cron: infra-error, package: infra-error)'
    );
    expect(header).toMatch(/ · labeled 2\/2$/);
  });
});

describe('artifact attempts', () => {
  const withDir = (fn: (dir: string) => void) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'upstream-watch-canary-'));
    try {
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  // download-artifact with merge-multiple: false, one directory per artifact
  const put = (dir: string, artifact: string, file: string, value: unknown) => {
    mkdirSync(path.join(dir, artifact), { recursive: true });
    writeFileSync(path.join(dir, artifact, file), JSON.stringify(value));
  };

  it('reads the highest attempt per canary report, falling back per kind', () => {
    withDir((dir) => {
      const report = (kind: string, attempt: number, value: unknown) =>
        put(
          dir,
          `canary-2026.9.8-${kind}-${attempt}`,
          `canary-2026.9.8-${kind}-${attempt}.json`,
          value
        );
      report('unit', 1, { typecheck: 'pass', unit: 'pass' });
      report('unit', 2, {
        typecheck: 'fail',
        unit: 'pass',
        nodeVersion: '24.16.0',
      });
      report('e2e-package', 1, { result: 'fail' });
      report('e2e-package', 2, {
        result: 'pass',
        coverage: 'partial',
        failedStep: '',
        errorExcerpt: '',
      });
      report('e2e-cron', 2, { result: 'weird' });
      // only attempt 1 ran this shard (a partial re-run); it still counts
      report('e2e-baseline', 1, { result: 'pass' });
      // another release's report is ignored
      put(
        dir,
        'canary-2026.9.80-e2e-baseline-3',
        'canary-2026.9.80-e2e-baseline-3.json',
        { result: 'fail' }
      );
      expect(readCanaryReports(dir, '2026.9.8')).toEqual({
        unit: { typecheck: 'fail', unit: 'pass', nodeVersion: '24.16.0' },
        e2e: {
          package: {
            result: 'pass',
            coverage: 'partial',
            failedStep: undefined,
            errorExcerpt: undefined,
          },
          cron: {
            result: 'infra-error',
            coverage: undefined,
            failedStep: undefined,
            errorExcerpt: undefined,
          },
          baseline: {
            result: 'pass',
            coverage: undefined,
            failedStep: undefined,
            errorExcerpt: undefined,
          },
        },
      });
    });
  });

  it('selects the digest artifact of the highest attempt', () => {
    withDir((dir) => {
      put(dir, 'openclaw-watch-2026.9.8-1', 'digest-input.json', {});
      put(dir, 'openclaw-watch-2026.9.8-2', 'digest-input.json', {});
      put(dir, 'openclaw-watch-2026.9.80-3', 'digest-input.json', {});
      put(dir, 'openclaw-watch-post-2026.9.8-4', 'post.json', {});
      expect(selectDigestArtifact(dir, '2026.9.8')).toEqual({
        name: 'openclaw-watch-2026.9.8-2',
        dir: path.join(dir, 'openclaw-watch-2026.9.8-2'),
      });
      expect(selectDigestArtifact(dir, '2026.9.9')).toBeUndefined();
      expect(
        selectDigestArtifact(path.join(dir, 'missing'), '2026.9.8')
      ).toBeUndefined();
    });
  });
});
