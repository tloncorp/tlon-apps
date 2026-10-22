// Decides what the release watch run does: which versions to compare,
// whether to post, and the drift footer values. Writes GitHub step outputs.
//
// node scripts/upstream-watch/discover.ts --npm npm.json --tags tags.txt \
//   --bundles bundles.json --event schedule [--state <json>]
import { appendFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  compareVersions,
  isStable,
  lineOf,
  parseTagList,
  versionsBetween,
} from './versions.ts';

export interface WatchState {
  lastLatest: string;
  lastPostedAt: string | null;
  reportedUnresolved: string[];
}

export interface DiscoverInput {
  npm: { 'dist-tags'?: Record<string, string>; time?: Record<string, string> };
  tags: Set<string>;
  prodPins: Record<string, string>;
  state: WatchState | undefined;
  event: string;
  version?: string;
  baseline?: string;
  dryRun: boolean;
}

export interface Discovery {
  shouldPost: boolean;
  prev: string;
  next: string;
  intermediates: string[];
  // published to npm with no upstream git tag, so there is nothing to fetch
  // or read; the digest reports each as incomplete
  untaggedIntermediates: string[];
  latestPublishedAt?: string;
  // npm's `latest`, the line after the one we track; shown as a look-ahead
  latest?: string;
  prodPins: Record<string, string>;
  noTag: boolean;
  // set on the first run: the state to write, with nothing posted
  bootstrap?: WatchState;
  trigger: 'extended-stable' | 'dispatch';
  releasesBehindOnLine?: number;
  daysBehind?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function discover(input: DiscoverInput): Discovery {
  // The plugin ships on extended-stable; `latest` runs a line ahead of it.
  const tracked = input.npm['dist-tags']?.['extended-stable'];
  const time = input.npm.time ?? {};
  if (!tracked || !isStable(tracked)) {
    throw new Error(`npm extended-stable is not a stable version: ${tracked}`);
  }
  const forced = input.event === 'workflow_dispatch' && !!input.version;
  if (forced && !input.baseline) {
    throw new Error('a dispatch with `version` needs `baseline` as well');
  }
  const next = forced ? input.version! : tracked;
  const prev =
    (forced ? input.baseline : input.baseline || input.state?.lastLatest) ??
    tracked;
  // Both end up in git refs and shell arguments downstream.
  for (const version of [next, prev]) {
    if (!isStable(version)) {
      throw new Error(`not a stable OpenClaw version: ${version}`);
    }
  }

  const bootstrap =
    !input.state && !forced && !input.dryRun
      ? { lastLatest: tracked, lastPostedAt: null, reportedUnresolved: [] }
      : undefined;
  const shouldPost =
    (input.event === 'schedule' &&
      !!input.state &&
      tracked !== input.state.lastLatest) ||
    (forced && !input.dryRun);

  const pins = Object.values(input.prodPins).filter(isStable);
  const oldestPin = pins.sort(compareVersions)[0];
  const releasesBehindOnLine = oldestPin
    ? Object.keys(time).filter(
        (v) =>
          isStable(v) &&
          lineOf(v) === lineOf(next) &&
          compareVersions(v, oldestPin) > 0 &&
          compareVersions(v, next) <= 0
      ).length
    : undefined;
  const nextAt = Date.parse(time[next] ?? '');
  const pinAt = oldestPin ? Date.parse(time[oldestPin] ?? '') : NaN;
  const daysBehind =
    Number.isNaN(nextAt) || Number.isNaN(pinAt)
      ? undefined
      : Math.max(0, Math.floor((nextAt - pinAt) / DAY_MS));

  const between =
    compareVersions(prev, next) < 0 ? versionsBetween(time, prev, next) : [];
  const latest = input.npm['dist-tags']?.latest;
  return {
    shouldPost,
    prev,
    next,
    intermediates: between.filter((v) => input.tags.has(v)),
    untaggedIntermediates: between.filter((v) => !input.tags.has(v)),
    latestPublishedAt: time[next],
    latest: latest && isStable(latest) ? latest : undefined,
    prodPins: input.prodPins,
    noTag: !input.tags.has(next),
    bootstrap,
    trigger: forced ? 'dispatch' : 'extended-stable',
    releasesBehindOnLine,
    daysBehind,
  };
}

export function parseState(text: string | undefined) {
  if (!text?.trim()) {
    return undefined;
  }
  const state = JSON.parse(text) as Partial<WatchState>;
  // lastLatest holds the tracked extended-stable version; the name is historical.
  if (typeof state.lastLatest !== 'string') {
    throw new Error('OPENCLAW_WATCH_STATE has no lastLatest');
  }
  return {
    lastLatest: state.lastLatest,
    lastPostedAt: state.lastPostedAt ?? null,
    reportedUnresolved: Array.isArray(state.reportedUnresolved)
      ? state.reportedUnresolved.filter((s) => typeof s === 'string')
      : [],
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      npm: { type: 'string' },
      tags: { type: 'string' },
      // { "<bundle>": "<pinned core version>" }
      bundles: { type: 'string' },
      state: { type: 'string', default: '' },
      event: { type: 'string' },
      version: { type: 'string', default: '' },
      baseline: { type: 'string', default: '' },
      'dry-run': { type: 'string', default: 'false' },
    },
  });
  if (!values.npm || !values.tags || !values.bundles || !values.event) {
    throw new Error('--npm, --tags, --bundles and --event are required');
  }
  const state = parseState(values.state);
  const result = discover({
    npm: JSON.parse(readFileSync(values.npm, 'utf8')),
    tags: parseTagList(readFileSync(values.tags, 'utf8')),
    prodPins: JSON.parse(readFileSync(values.bundles, 'utf8')),
    state,
    event: values.event,
    version: values.version || undefined,
    baseline: values.baseline || undefined,
    dryRun: values['dry-run'] === 'true',
  });

  const outputs: Record<string, string> = {
    should_post: String(result.shouldPost),
    prev: result.prev,
    next: result.next,
    intermediates: JSON.stringify(result.intermediates),
    untagged_intermediates: JSON.stringify(result.untaggedIntermediates),
    published_at: result.latestPublishedAt ?? '',
    latest: result.latest ?? '',
    prod_pins: JSON.stringify(result.prodPins),
    no_tag: String(result.noTag),
    trigger: result.trigger,
    drift: JSON.stringify({
      releasesBehindOnLine: result.releasesBehindOnLine,
      daysBehind: result.daysBehind,
    }),
    bootstrap_state: result.bootstrap ? JSON.stringify(result.bootstrap) : '',
    reported_unresolved: JSON.stringify(state?.reportedUnresolved ?? []),
  };
  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, lines + '\n');
  }
  process.stdout.write(lines + '\n');
}

if (import.meta.main) {
  main();
}
