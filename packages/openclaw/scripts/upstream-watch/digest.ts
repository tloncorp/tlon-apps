// Deterministic prep for the OpenClaw release watch: changelog bullets, the
// plugin's SDK subpaths classified against both releases, the diff scoped to
// our surface, and the hard signals computed from it. No model.
//
// node scripts/upstream-watch/digest.ts --prev 2026.9.4 --next 2026.9.8 \
//   --intermediates 2026.9.5,2026.9.6,2026.9.7 --repo <upstream clone> \
//   --plugin . --out <dir>
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { type Bullet, dedupeBullets, parseChangelog } from './changelog.ts';
import { fallbackLines } from './render.ts';
import {
  type Hints,
  type Signals,
  engineSignal,
  readSchemaVersion,
  schemaSignal,
  subpathSignal,
  truncateDiff,
  zodHint,
} from './signals.ts';
import {
  type Subpath,
  classifySubpaths,
  scanPluginImports,
} from './subpaths.ts';
import { lineOf } from './versions.ts';

export interface Manifest {
  configKeys: string[];
  extensions: string[];
  extraPaths: string[];
  workarounds: { id: string; note: string }[];
  profile: Record<string, unknown>;
}

export interface Drift {
  prodPins: Record<string, string>;
  extendedStable?: string;
  releasesBehindOnLine?: number;
  daysBehind?: number;
}

export interface DigestInput {
  prev: string;
  next: string;
  intermediates: string[];
  publishedAt?: string;
  // `next` is on a different YYYY.M line than `prev`
  lineChange: boolean;
  bullets: Bullet[];
  bulletsBeforeDedupe: number;
  subpaths: Subpath[];
  // absent-in-both subpaths not yet reported in an earlier post
  unresolvedToReport: string[];
  signals: Signals;
  hints: Hints;
  drift: Drift;
  incomplete: string[];
  // extensions the manifest names that exist at neither release
  missingExtensions: string[];
  diffFiles: number;
}

export type Git = (args: string[]) => string | undefined;

export function gitIn(repo: string): Git {
  return (args) => {
    const result = spawnSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
    });
    return result.status === 0 ? result.stdout : undefined;
  };
}

const SCHEMA_CONTRACT = 'src/state/openclaw-state-db-contract.ts';
const NOT_TESTS = ':(glob,exclude)**/*.test.ts';

export function buildDigest({
  git,
  prev,
  next,
  intermediates,
  pluginDir,
  manifest,
  canaryNode,
  reportedUnresolved = [],
  drift,
  publishedAt,
}: {
  git: Git;
  prev: string;
  next: string;
  intermediates: string[];
  pluginDir: string;
  manifest: Manifest;
  canaryNode: string;
  reportedUnresolved?: string[];
  drift: Drift;
  publishedAt?: string;
}): { digest: DigestInput; diff: string; files: string } {
  const incomplete: string[] = [];

  const parsed: Bullet[] = [];
  for (const release of [...intermediates, next]) {
    const markdown = git(['show', `v${release}:CHANGELOG/${release}.md`]);
    if (markdown === undefined) {
      incomplete.push(`changelog missing for ${release}`);
      continue;
    }
    parsed.push(...parseChangelog(markdown, release));
  }
  const bullets = dedupeBullets(parsed);

  const prevPkg = readJson(git, prev, 'package.json');
  const nextPkg = readJson(git, next, 'package.json');
  for (const [version, pkg] of [
    [prev, prevPkg],
    [next, nextPkg],
  ] as const) {
    if (!pkg) {
      incomplete.push(`package.json unreadable at ${version}`);
    }
  }

  const { subpaths: imported } = scanPluginImports(pluginDir);
  // Without both export maps every subpath would read as absent; say so
  // instead of reporting them.
  const subpaths =
    prevPkg && nextPkg
      ? classifySubpaths(
          imported,
          prevPkg.exports as Record<string, unknown> | undefined,
          nextPkg.exports as Record<string, unknown> | undefined
        )
      : [];

  const prevSchema = schemaVersionAt(git, prev);
  const nextSchema = schemaVersionAt(git, next);
  for (const [version, schema] of [
    [prev, prevSchema],
    [next, nextSchema],
  ] as const) {
    if (schema === undefined) {
      incomplete.push(`OPENCLAW_STATE_SCHEMA_VERSION not found at ${version}`);
    }
  }

  const missingExtensions = manifest.extensions.filter(
    (name) =>
      git(['cat-file', '-e', `v${next}:extensions/${name}`]) === undefined &&
      git(['cat-file', '-e', `v${prev}:extensions/${name}`]) === undefined
  );
  // Core surface first, then each extension tree: git sorts a diff by path,
  // and the truncated copy should spend its lines on the SDK and config
  // before the much larger extensions. Upstream's own tests are not surface.
  const groups = [
    [
      ...new Set([
        ...subpaths.flatMap((s) => (s.source ? [s.source] : [])),
        ...manifest.extraPaths,
      ]),
    ],
    ...manifest.extensions
      .filter((name) => !missingExtensions.includes(name))
      .map((name) => [`extensions/${name}`]),
  ];
  const diffs: string[] = [];
  const stats: string[] = [];
  for (const paths of groups) {
    const range = [`v${prev}`, `v${next}`, '--', ...paths, NOT_TESTS];
    const diff = git(['diff', ...range]);
    if (diff === undefined) {
      incomplete.push(`git diff v${prev}..v${next} -- ${paths[0]} failed`);
      continue;
    }
    diffs.push(diff);
    stats.push(git(['diff', '--numstat', ...range]) ?? '');
  }
  const fullDiff = diffs.join('');

  const signals: Signals = {
    sdkSubpathRemoved: subpathSignal(subpaths, prev, next),
    engineChanged: engineSignal(
      engineRange(prevPkg),
      engineRange(nextPkg),
      canaryNode
    ),
    stateSchemaBumped: schemaSignal(prevSchema, nextSchema),
  };
  // An unreadable package.json is not an engine change.
  if (!prevPkg || !nextPkg) {
    signals.engineChanged.fired = false;
    signals.engineChanged.evidence = [];
  }

  const digest: DigestInput = {
    prev,
    next,
    intermediates,
    publishedAt,
    lineChange: lineOf(prev) !== lineOf(next),
    bullets,
    bulletsBeforeDedupe: parsed.length,
    subpaths,
    unresolvedToReport: subpaths
      .filter(
        (s) =>
          s.class === 'absent-in-both' &&
          !reportedUnresolved.includes(s.subpath)
      )
      .map((s) => s.subpath),
    signals,
    hints: { configKeyInZodDiff: zodHint(fullDiff, manifest.configKeys) },
    drift,
    incomplete,
    missingExtensions,
    diffFiles: (fullDiff.match(/^diff --git /gm) ?? []).length,
  };
  return { digest, diff: truncateDiff(fullDiff), files: stats.join('') };
}

function readJson(git: Git, version: string, file: string) {
  const text = git(['show', `v${version}:${file}`]);
  if (text === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function engineRange(pkg: Record<string, unknown> | undefined) {
  const engines = pkg?.engines as Record<string, unknown> | undefined;
  return typeof engines?.node === 'string' ? engines.node : undefined;
}

// The constant has lived in the state-DB contract since 9.x; if upstream moves
// it, look through the rest of src/state rather than grepping the whole tree,
// which in a blobless clone would fetch every blob.
function schemaVersionAt(git: Git, version: string) {
  const contract = git(['show', `v${version}:${SCHEMA_CONTRACT}`]);
  const direct =
    contract === undefined ? undefined : readSchemaVersion(contract);
  if (direct !== undefined) {
    return direct;
  }
  const files = (
    git(['ls-tree', '-r', '--name-only', `v${version}`, '--', 'src/state']) ??
    ''
  )
    .split('\n')
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
  for (const file of files) {
    const source = git(['show', `v${version}:${file}`]);
    const found = source === undefined ? undefined : readSchemaVersion(source);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function main() {
  const { values } = parseArgs({
    options: {
      prev: { type: 'string' },
      next: { type: 'string' },
      intermediates: { type: 'string', default: '' },
      repo: { type: 'string' },
      plugin: { type: 'string', default: '.' },
      manifest: { type: 'string' },
      out: { type: 'string' },
      'prod-pins': { type: 'string', default: '{}' },
      'extended-stable': { type: 'string' },
      'published-at': { type: 'string' },
      // { releasesBehindOnLine, daysBehind } from the discover step, which
      // has npm's full release list
      drift: { type: 'string', default: '{}' },
      'reported-unresolved': { type: 'string', default: '[]' },
      'canary-node': { type: 'string' },
    },
  });
  const { prev, next, repo, out } = values;
  if (!prev || !next || !repo || !out) {
    throw new Error('--prev, --next, --repo and --out are required');
  }
  const pluginDir = path.resolve(values.plugin);
  const manifest = JSON.parse(
    readFileSync(
      values.manifest ?? path.join(pluginDir, 'upstream-watch.json'),
      'utf8'
    )
  ) as Manifest;
  const canaryNode =
    values['canary-node'] ??
    readFileSync(path.join(pluginDir, '../../.nvmrc'), 'utf8').trim();
  const extraDrift = JSON.parse(values.drift) as Partial<Drift>;

  const { digest, diff, files } = buildDigest({
    git: gitIn(repo),
    prev,
    next,
    intermediates: values.intermediates.split(',').filter(Boolean),
    pluginDir,
    manifest,
    canaryNode,
    reportedUnresolved: JSON.parse(values['reported-unresolved']) as string[],
    drift: {
      prodPins: JSON.parse(values['prod-pins']) as Record<string, string>,
      extendedStable: values['extended-stable'] || undefined,
      releasesBehindOnLine: extraDrift.releasesBehindOnLine,
      daysBehind: extraDrift.daysBehind,
    },
    publishedAt: values['published-at'] || undefined,
  });

  mkdirSync(out, { recursive: true });
  writeFileSync(
    path.join(out, 'digest-input.json'),
    JSON.stringify(digest, null, 2) + '\n'
  );
  writeFileSync(path.join(out, 'upstream.diff'), diff);
  // the full file list, since the truncated diff omits most extension files
  writeFileSync(path.join(out, 'upstream-diff-files.txt'), files);
  writeFileSync(
    path.join(out, 'post-fallback.txt'),
    fallbackLines(digest).join('\n') + '\n'
  );
  process.stderr.write(
    `digest ${prev} → ${next}: ${digest.bullets.length} bullets (${digest.bulletsBeforeDedupe} before dedupe), ${digest.subpaths.length} subpaths, ${digest.diffFiles} diff files, ${digest.incomplete.length} incomplete\n`
  );
}

if (import.meta.main) {
  main();
}
