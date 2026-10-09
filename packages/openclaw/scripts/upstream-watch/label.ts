// Labels each digest bullet with Jev and writes labeled.jsonl, one row per
// bullet in the same shape as the probe fixtures. Never fails the step: a
// bullet whose request fails is written as { labeled: false, reason }.
//
// OPENROUTER_API_KEY=… node scripts/upstream-watch/label.ts \
//   --digest <dir>/digest-input.json --out <dir>/labeled.jsonl
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import type { Bullet } from './changelog.ts';
import type { DigestInput, Manifest } from './digest.ts';
import {
  type DecisionResult,
  type RetryOptions,
  type Workaround,
  LABEL_QUESTIONS,
  costOf,
  decideWithRetry,
  parseAddresses,
  parseLabel,
  workaroundQuestions,
} from './jev.ts';
import { type LabeledRow, THRESHOLD, oursOf } from './policy.ts';

const CONCURRENCY = 8;

// Manifest profile entries that are deployment facts, regenerated from the
// digest on every run so they cannot go stale. Each must appear in the
// manifest exactly as written here.
export const PROFILE_PLACEHOLDERS = {
  subpaths: '<filled at label time: imported plugin-sdk subpaths>',
  versions:
    '<filled at label time: production OpenClaw versions and the releases compared>',
  node: '<filled at label time: plugin CI Node version and the Node range OpenClaw requires>',
} as const;

export function buildPluginProfile(
  manifestProfile: Record<string, unknown>,
  digest: Pick<DigestInput, 'prev' | 'next' | 'subpaths' | 'drift' | 'signals'>,
  ciNode: string
): Record<string, unknown> {
  const fills: Record<string, string> = {
    [PROFILE_PLACEHOLDERS.subpaths]: subpathsLine(digest),
    [PROFILE_PLACEHOLDERS.versions]: versionsLine(digest),
    [PROFILE_PLACEHOLDERS.node]: nodeLine(digest, ciNode),
  };
  const filled = new Set<string>();
  const fill = (value: unknown): unknown => {
    if (typeof value === 'string' && value in fills) {
      filled.add(value);
      return fills[value];
    }
    if (Array.isArray(value)) {
      return value.map(fill);
    }
    return value;
  };
  const profile = Object.fromEntries(
    Object.entries(manifestProfile).map(([key, value]) => [key, fill(value)])
  );
  const missing = Object.keys(fills).filter((p) => !filled.has(p));
  if (missing.length > 0) {
    throw new Error(
      `upstream-watch.json profile is missing placeholder(s): ${missing.join(', ')}`
    );
  }
  return profile;
}

function subpathsLine({ subpaths }: Pick<DigestInput, 'subpaths'>) {
  const names = subpaths.map(({ subpath }) =>
    subpath === '.'
      ? 'openclaw (root)'
      : subpath.startsWith('plugin-sdk/')
        ? subpath.slice('plugin-sdk/'.length)
        : `openclaw/${subpath}`
  );
  return `openclaw/plugin-sdk subpaths imported by the plugin: ${names.join(', ')}`;
}

function versionsLine({
  prev,
  next,
  drift,
}: Pick<DigestInput, 'prev' | 'next' | 'drift'>) {
  const byVersion = new Map<string, string[]>();
  for (const [bundle, version] of Object.entries(drift.prodPins)) {
    if (version) {
      byVersion.set(version, [...(byVersion.get(version) ?? []), bundle]);
    }
  }
  const prod =
    byVersion.size === 0
      ? 'production bots run an OpenClaw version the watch could not read'
      : byVersion.size === 1
        ? `production bots run OpenClaw ${[...byVersion.keys()][0]}`
        : `production bots run OpenClaw ${[...byVersion]
            .map(([version, bundles]) => `${version} (${bundles.join(', ')})`)
            .join(', ')}`;
  return `${prod}; this digest compares ${prev} → ${next}`;
}

function nodeLine(
  { next, signals }: Pick<DigestInput, 'next' | 'signals'>,
  ciNode: string
) {
  const range = signals.engineChanged.next;
  return (
    `the plugin's CI runs on Node ${ciNode}; ` +
    (range
      ? `OpenClaw ${next} requires Node ${range}`
      : `OpenClaw ${next} declares no engines.node range`)
  );
}

export interface LabelOptions extends RetryOptions {
  apiKey: string | undefined;
  profile: Record<string, unknown>;
  workarounds: Workaround[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  concurrency?: number;
}

export async function labelBullets(
  bullets: Bullet[],
  options: LabelOptions
): Promise<{ rows: LabeledRow[]; cost: number }> {
  const { apiKey, profile, workarounds } = options;
  let cost = 0;
  const base = (bullet: Bullet) => ({
    release: bullet.release,
    section: bullet.section,
    bullet: bullet.text,
    prs: bullet.prs,
  });
  if (!apiKey) {
    return {
      rows: bullets.map((b) => ({
        ...base(b),
        labeled: false,
        reason: 'no-api-key',
      })),
      cost,
    };
  }
  const call = (bullet: Bullet, questions: Record<string, unknown>) =>
    // Retries wait inside the pool slot, so the concurrency bound holds.
    decideWithRetry(
      {
        release: bullet.release,
        section: bullet.section,
        bullet: bullet.text,
        plugin_profile: profile,
      },
      questions,
      {
        apiKey,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs,
        sleep: options.sleep,
        budgetMs: options.budgetMs,
      }
    );

  const rows = await mapPool(
    bullets,
    options.concurrency ?? CONCURRENCY,
    async (bullet): Promise<LabeledRow> => {
      const result = await call(bullet, LABEL_QUESTIONS);
      if (result.outcome !== 'ok') {
        return { ...base(bullet), labeled: false, reason: reasonOf(result) };
      }
      cost += costOf(result.body);
      const label = parseLabel(result.body);
      if (!label) {
        return { ...base(bullet), labeled: false, reason: 'invalid-answer' };
      }
      return { ...base(bullet), labeled: true, ...label, ms: result.ms };
    }
  );

  // The workaround question only matters for bullets in our area, so it is a
  // second, smaller pass. A failure here leaves the label intact.
  if (workarounds.length > 0) {
    const questions = workaroundQuestions(workarounds);
    const ours = rows.flatMap((row, i) =>
      row.labeled && oursOf(row) >= THRESHOLD ? [i] : []
    );
    await mapPool(ours, options.concurrency ?? CONCURRENCY, async (i) => {
      const result = await call(bullets[i], questions);
      if (result.outcome !== 'ok') {
        rows[i].addresses_error = reasonOf(result);
        return;
      }
      cost += costOf(result.body);
      const addresses = parseAddresses(result.body, workarounds);
      if (addresses) {
        rows[i].addresses = addresses;
      } else {
        rows[i].addresses_error = 'invalid-answer';
      }
    });
  }

  return { rows, cost };
}

function reasonOf(result: Exclude<DecisionResult, { outcome: 'ok' }>) {
  return result.outcome === 'http-error'
    ? `http-${result.status}`
    : result.outcome;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

async function main() {
  const { values } = parseArgs({
    options: {
      digest: { type: 'string' },
      manifest: { type: 'string' },
      out: { type: 'string' },
    },
  });
  if (!values.digest || !values.out) {
    throw new Error('--digest and --out are required');
  }
  const digest = JSON.parse(readFileSync(values.digest, 'utf8')) as DigestInput;
  const manifest = JSON.parse(
    readFileSync(
      values.manifest ??
        path.join(import.meta.dirname, '../../upstream-watch.json'),
      'utf8'
    )
  ) as Manifest;

  // The repo's .nvmrc is what setup-node gives the plugin's CI and canary.
  const ciNode = readFileSync(
    path.join(import.meta.dirname, '../../../../.nvmrc'),
    'utf8'
  ).trim();
  const profile = buildPluginProfile(manifest.profile, digest, ciNode);

  const started = Date.now();
  const { rows, cost } = await labelBullets(digest.bullets, {
    apiKey: process.env.OPENROUTER_API_KEY || undefined,
    profile,
    workarounds: manifest.workarounds,
  });
  writeFileSync(
    values.out,
    rows.map((row) => JSON.stringify(row)).join('\n') +
      (rows.length ? '\n' : '')
  );

  const failures = new Map<string, number>();
  for (const row of rows) {
    if (row.labeled === false) {
      const reason = row.reason ?? 'unknown';
      failures.set(reason, (failures.get(reason) ?? 0) + 1);
    }
  }
  const labeled = rows.filter((row) => row.labeled).length;
  process.stderr.write(
    `labeled ${labeled}/${rows.length} in ${((Date.now() - started) / 1000).toFixed(1)} s, $${cost.toFixed(4)}` +
      (failures.size
        ? `; failed: ${JSON.stringify(Object.fromEntries(failures))}`
        : '') +
      '\n'
  );
}

if (import.meta.main) {
  await main();
}
