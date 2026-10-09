// Turns the digest, the labels and the canary reports into the chat post the
// CI relay delivers: { lines, link }.
//
// node scripts/upstream-watch/render.ts --digest <dir>/digest-input.json \
//   --labeled <dir>/labeled.jsonl --canary-dir <dir> --run-url <url> --out <dir>
// or, from downloaded artifacts: --digest-dir <dir> --next <version> …
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { prNumbers } from './changelog.ts';
import type { DigestInput } from './digest.ts';
import {
  type LabeledRow,
  type Sections,
  classifyRows,
  relevantKind,
} from './policy.ts';
import { subjectOf } from './subpaths.ts';
import { shortVersion } from './versions.ts';

// Stricter than the relay (40 lines × 400 chars, 8 KiB) on purpose, so the
// relay's limits never decide what gets cut.
export const MAX_LINES = 15;
export const MAX_LINE_CHARS = 200;
export const MAX_BODY_BYTES = 4096;
// label-derived items shown per section
const SECTION_CAP = 2;

export const E2E_SHARDS = ['baseline', 'cron', 'package'] as const;

export type CheckResult = 'pass' | 'fail' | 'skipped' | 'infra-error';

export interface CanaryReports {
  unit?: { typecheck: CheckResult; unit: CheckResult; nodeVersion?: string };
  e2e: Record<
    string,
    {
      result: CheckResult;
      coverage?: string;
      failedStep?: string;
      errorExcerpt?: string;
    }
  >;
}

export interface Post {
  lines: string[];
  link?: string;
}

interface BodyLine {
  text: string;
  // section titles carry no content of their own and are never left dangling
  title?: boolean;
}

export function renderPost({
  digest,
  rows,
  canary,
  trigger = 'latest',
  runUrl,
  artifactName,
}: {
  digest: DigestInput;
  // undefined before labeling has run
  rows?: LabeledRow[];
  // undefined before the canary has reported
  canary?: CanaryReports;
  trigger?: 'latest' | 'dispatch';
  runUrl?: string;
  artifactName?: string;
}): { post: Post; sections?: Sections; fallback: boolean } {
  const sections = rows
    ? classifyRows(
        rows,
        digest.subpaths.map((s) => s.subpath)
      )
    : undefined;
  const total = digest.bullets.length;
  const labeled = sections?.labeled ?? 0;
  const fallback = !sections || labeled < total / 2;

  const header = headerLine(digest, canary, trigger, labeled, total);
  const top = [header];
  if (digest.incomplete.length > 0) {
    top.push(`incomplete: ${digest.incomplete.join('; ')}`);
  }
  const bottom = [
    'canary green = plugin fixtures pass on this core, not an upgrade approval',
    prodLine(digest),
    linksLine(digest, artifactName),
  ];

  const body: BodyLine[] = [
    ...section('breaks-us', breaksUs(digest, canary)),
    ...section(
      'unresolved today',
      digest.unresolvedToReport.map(
        (subpath) =>
          `  • openclaw/${subpath} is not exported at ${digest.prev} or ${digest.next}`
      )
    ),
    ...section('canary failures', canaryFailures(canary)),
  ];
  if (fallback) {
    body.push(
      ...section('changes-for-us', signalChanges(digest)),
      ...section(
        `labels unavailable (${labeled}/${total}), highlights`,
        digest.bullets
          .filter((b) => b.section === 'Highlights')
          .map((b) => item(b.text, b.prs))
      )
    );
  } else {
    // Per-section caps keep one long section from pushing the relevant line
    // out of the post; what is cut is counted in the title.
    const byAffects = (list: { row: LabeledRow }[]) =>
      [...list].sort((x, y) => (y.row.affects ?? 0) - (x.row.affects ?? 0));
    const changes = byAffects(sections.changes);
    // confirmed deprecations first, then the check: subset, under one cap
    const deprecations = [
      ...sections.deprecations.map(({ row, names }) => {
        const rest = row.bullet.slice(subjectOf(row.bullet).length + 1);
        return `  • ${names?.join(', ')} (we import it) → ${clip(plain(rest), 120)}${prRef(row)}`;
      }),
      ...byAffects(sections.check).map(
        ({ row }) => `  • check: ${clip(plain(row.bullet), 140)}${prRef(row)}`
      ),
    ];
    body.push(
      ...section(
        'deprecations-for-us',
        deprecations.slice(0, SECTION_CAP),
        Math.max(0, deprecations.length - SECTION_CAP)
      ),
      ...section(
        'changes-for-us',
        [
          ...signalChanges(digest),
          ...changes
            .slice(0, SECTION_CAP)
            .map(({ row }) => item(row.bullet, rowPrs(row))),
        ],
        Math.max(0, changes.length - SECTION_CAP)
      ),
      ...section(
        'may-fix-workaround',
        sections.mayFix
          .slice(0, SECTION_CAP)
          .map(
            ({ row, workaround, p }) =>
              `  • ${workaround} ← "${clip(plain(subjectOf(row.bullet)), 90)}" (${[firstPr(row), p.toFixed(2)].filter(Boolean).join(', ')})`
          ),
        Math.max(0, sections.mayFix.length - SECTION_CAP)
      )
    );
    if (sections.relevant.length > 0) {
      body.push({ text: relevantLine(sections) });
    }
  }

  const link = runUrl;
  const post = fit(top, body, bottom, link);
  return { post, sections, fallback };
}

// The plain-text post B writes for when labeling is unavailable: signals and
// highlights only.
export function fallbackLines(digest: DigestInput) {
  return renderPost({ digest }).post.lines;
}

export function noTagPost(prev: string, next: string, runUrl?: string): Post {
  return {
    lines: [
      capLine(
        `OpenClaw ${prev} → ${next}: incomplete: npm has ${next} but upstream has no tag v${next} yet; state not advanced, the next run retries`
      ),
    ],
    link: runUrl,
  };
}

export function prepFailedPost({
  prev,
  next,
  canary,
  runUrl,
}: {
  prev: string;
  next: string;
  canary?: CanaryReports;
  runUrl?: string;
}): Post {
  return {
    lines: [
      capLine(`OpenClaw ${prev} → ${next} — ${canaryText(next, canary)}`),
      'incomplete: the digest step failed, so there are no changelog labels or signals; see the run',
      'canary green = plugin fixtures pass on this core, not an upgrade approval',
    ],
    link: runUrl,
  };
}

function headerLine(
  digest: DigestInput,
  canary: CanaryReports | undefined,
  trigger: 'latest' | 'dispatch',
  labeled: number,
  total: number
) {
  const { prev, next } = digest;
  const meta = [
    trigger === 'latest' ? 'latest' : 'requested',
    digest.publishedAt ? monthDay(digest.publishedAt) : undefined,
  ]
    .filter(Boolean)
    .join(', ');
  const also = intermediatesText(digest.intermediates, next);
  const line = digest.lineChange ? ' (line change)' : '';
  // The canary status and the labeled count always survive; the version
  // part is what gives way.
  const head = `OpenClaw ${prev} → ${next}${line} (${meta}${also})`;
  const tail = ` — ${canaryText(next, canary)} · labeled ${labeled}/${total}`;
  return `${clip(head, MAX_LINE_CHARS - [...tail].length)}${tail}`;
}

function intermediatesText(intermediates: string[], next: string) {
  const short = intermediates.map((v) => shortVersion(v, next));
  if (short.length === 0) {
    return '';
  }
  return short.length > 3
    ? `; also ${short[0]} … ${short.at(-1)} (${short.length})`
    : `; also ${short.join(', ')}`;
}

const MARKS: Record<CheckResult, string> = {
  pass: '✓',
  fail: '✗',
  skipped: '–',
  'infra-error': '?',
};

function canaryText(next: string, canary: CanaryReports | undefined) {
  const label = `canary ${shortVersion(next, next)}`;
  if (!canary) {
    return `${label}: pending`;
  }
  const unit = canary.unit;
  const shards = E2E_SHARDS.map((shard) => ({
    shard,
    result: canary.e2e[shard]?.result ?? 'infra-error',
  }));
  const failing = shards.filter((s) => s.result !== 'pass');
  const e2eMark =
    failing.length === 0
      ? MARKS.pass
      : failing.some((s) => s.result === 'fail')
        ? MARKS.fail
        : MARKS['infra-error'];
  const notes = failing.map((s) => `${s.shard}: ${s.result}`);
  if (canary.e2e.package?.coverage === 'partial') {
    notes.push('package: partial');
  }
  const e2e = notes.length
    ? `e2e ${e2eMark} (${notes.join(', ')})`
    : `e2e ${e2eMark}`;
  return `${label}: tsc ${MARKS[unit?.typecheck ?? 'infra-error']} unit ${MARKS[unit?.unit ?? 'infra-error']} ${e2e}`;
}

function breaksUs(digest: DigestInput, canary: CanaryReports | undefined) {
  const { signals, next } = digest;
  const lines = signals.sdkSubpathRemoved.evidence.map((e) => `  • ${e}`);
  if (canary?.unit?.typecheck === 'fail') {
    lines.push(`  • tsc fails against ${next} in the canary`);
  }
  const engine = signals.engineChanged;
  if (engine.fired && engine.canarySatisfies === false) {
    lines.push(
      `  • ${engine.evidence[0]}: the canary's Node does not satisfy it`
    );
  }
  return lines;
}

// Infra errors and missing reports already show in the header; a real
// failure gets its step and first error line.
function canaryFailures(canary: CanaryReports | undefined) {
  if (!canary) {
    return [];
  }
  return E2E_SHARDS.flatMap((shard) => {
    const report = canary.e2e[shard];
    if (report?.result !== 'fail') {
      return [];
    }
    const at = report.failedStep ? ` at ${report.failedStep}` : '';
    const excerpt = report.errorExcerpt ? ` — ${report.errorExcerpt}` : '';
    return [`  • e2e ${shard}: fail${at}${excerpt}`];
  });
}

function signalChanges(digest: DigestInput) {
  const { signals, hints } = digest;
  const lines = signals.stateSchemaBumped.evidence.map((e) => `  • ${e}`);
  const engine = signals.engineChanged;
  if (engine.fired && engine.canarySatisfies === true) {
    lines.push(`  • ${engine.evidence[0]} (the canary's Node satisfies it)`);
  } else if (engine.fired && engine.canarySatisfies === undefined) {
    lines.push(`  • check: ${engine.evidence[0]} (range not evaluated)`);
  }
  if (hints.configKeyInZodDiff.fired) {
    const keys = [
      ...new Set(
        hints.configKeyInZodDiff.evidence.map((e) => e.slice(0, e.indexOf(':')))
      ),
    ];
    lines.push(
      `  • check: removed zod schema lines define ${keys.join(', ')} (see the diff artifact)`
    );
  }
  return lines;
}

function relevantLine(sections: Sections) {
  const counts = { fix: 0, new_capability: 0, internal_or_docs: 0 };
  for (const { row } of sections.relevant) {
    counts[relevantKind(row)]++;
  }
  const top = [...sections.relevant]
    .sort((a, b) => (b.row.affects ?? 0) - (a.row.affects ?? 0))
    .slice(0, 3)
    .map(
      ({ row }) =>
        `${clip(plain(subjectOf(row.bullet)), 50)}${firstPr(row) ? ` ${firstPr(row)}` : ''}`
    );
  const kinds = [
    `${counts.fix} fixes`,
    `${counts.new_capability} new`,
    counts.internal_or_docs ? `${counts.internal_or_docs} internal` : undefined,
  ].filter(Boolean);
  return `relevant: ${sections.relevant.length} (${kinds.join(', ')}; top: ${top.join('; ')})`;
}

function prodLine(digest: DigestInput) {
  const { prodPins, extendedStable, releasesBehindOnLine, daysBehind } =
    digest.drift;
  const byVersion = new Map<string, string[]>();
  for (const [bundle, version] of Object.entries(prodPins)) {
    // The workflow writes "" for a bundle with no `.openclaw` field.
    if (typeof version !== 'string' || !version) continue;
    byVersion.set(version, [...(byVersion.get(version) ?? []), bundle]);
  }
  const pins = [...byVersion]
    .map(([version, bundles]) => `${bundles.join('/')} on ${version}`)
    .join(', ');
  const [, month] = digest.next.split('.');
  const behind = [
    releasesBehindOnLine !== undefined
      ? `${releasesBehindOnLine} releases`
      : undefined,
    daysBehind !== undefined ? `${daysBehind} d behind` : undefined,
  ].filter(Boolean);
  const parts = [
    `prod: ${pins || 'pins unavailable'}`,
    behind.length ? ` — ${month}.x line: ${behind.join(' / ')}` : '',
    extendedStable ? ` · extended-stable ${extendedStable}` : '',
  ];
  return parts.join('');
}

function linksLine(digest: DigestInput, artifactName?: string) {
  const changelog = `https://github.com/openclaw/openclaw/blob/v${digest.next}/CHANGELOG/${digest.next}.md`;
  return artifactName
    ? `changelog ${changelog} · diff, labels, dropped: artifact ${artifactName}`
    : `changelog ${changelog}`;
}

function section(title: string, items: string[], hidden = 0): BodyLine[] {
  const heading =
    hidden > 0 ? `${title} (+${hidden} more in the artifact)` : title;
  return items.length
    ? [{ text: heading, title: true }, ...items.map((text) => ({ text }))]
    : [];
}

// Overflow collapses into a count; the full lists are in the artifact.
function fit(
  top: string[],
  body: BodyLine[],
  bottom: string[],
  link?: string
): Post {
  const items = body.filter((line) => !line.title).length;
  for (
    let room = Math.min(body.length, MAX_LINES - top.length - bottom.length);
    room >= 0;
    room--
  ) {
    let kept = body;
    if (body.length > room) {
      kept = body.slice(0, Math.max(room - 1, 0));
      while (kept.length && kept[kept.length - 1].title) {
        kept = kept.slice(0, -1);
      }
    }
    const omitted = items - kept.filter((line) => !line.title).length;
    const lines = [
      ...top,
      ...kept.map((line) => line.text),
      ...(omitted > 0 ? [`… +${omitted} more in the run artifact`] : []),
      ...bottom,
    ].map(capLine);
    if (
      lines.length <= MAX_LINES &&
      bodyBytes({ lines, link }) <= MAX_BODY_BYTES
    ) {
      return link ? { lines, link } : { lines };
    }
  }
  // Only reachable if the fixed lines alone exceed the byte cap.
  return { lines: top.map(capLine), ...(link ? { link } : {}) };
}

export function bodyBytes(post: Post) {
  return Buffer.byteLength(JSON.stringify(post), 'utf8');
}

export function capLine(line: string) {
  return clip(line, MAX_LINE_CHARS);
}

function clip(text: string, max: number) {
  const chars = [...text];
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

function plain(text: string) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\s*\(#\d+(?:,\s*#\d+)*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowPrs(row: LabeledRow) {
  return row.prs ?? prNumbers(row.bullet);
}

function firstPr(row: LabeledRow) {
  const prs = rowPrs(row);
  return prs.length ? `#${prs[0]}` : undefined;
}

function prRef(row: LabeledRow) {
  return prSuffix(rowPrs(row));
}

function prSuffix(prs: number[]) {
  if (!prs.length) {
    return '';
  }
  return ` (#${prs[0]}${prs.length > 1 ? ` +${prs.length - 1}` : ''})`;
}

function item(text: string, prs: number[]) {
  return `  • ${clip(plain(text), 150)}${prSuffix(prs)}`;
}

function monthDay(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

// Artifacts carry the run attempt that made them (`…-<attempt>`). A partial
// re-run ("re-run failed jobs") sees earlier attempts' artifacts beside its
// own, so per kind the highest attempt wins; a full re-run makes higher
// numbers for every kind.
export function latestByKind(names: Iterable<string>, pattern: RegExp) {
  const latest = new Map<string, { name: string; attempt: number }>();
  for (const name of names) {
    const match = pattern.exec(name);
    if (!match?.groups) {
      continue;
    }
    const kind = match.groups.kind ?? '';
    const attempt = Number(match.groups.attempt);
    if ((latest.get(kind)?.attempt ?? -1) < attempt) {
      latest.set(kind, { name, attempt });
    }
  }
  return latest;
}

function escapeVersion(version: string) {
  return version.replace(/\./g, '\\.');
}

// The digest artifact directory (`openclaw-watch-<version>-<attempt>`) of the
// highest attempt under `dir`, as download-artifact lays them out.
export function selectDigestArtifact(dir: string, version: string) {
  if (!existsSync(dir)) {
    return undefined;
  }
  const pattern = new RegExp(
    `^openclaw-watch-${escapeVersion(version)}-(?<attempt>\\d+)$`
  );
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const chosen = latestByKind(entries, pattern).get('');
  return chosen
    ? { name: chosen.name, dir: path.join(dir, chosen.name) }
    : undefined;
}

export function readCanaryReports(dir: string, version: string) {
  const reports: CanaryReports = { e2e: {} };
  if (!existsSync(dir)) {
    return reports;
  }
  const escaped = escapeVersion(version);
  const files = new Map<string, string>();
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    files.set(path.basename(file), file);
  }
  const read = (name: string) =>
    JSON.parse(
      readFileSync(path.join(dir, files.get(name)!), 'utf8')
    ) as Record<string, unknown>;
  const unit = latestByKind(
    files.keys(),
    new RegExp(`^canary-${escaped}-unit-(?<attempt>\\d+)\\.json$`)
  ).get('');
  if (unit) {
    const json = read(unit.name);
    reports.unit = {
      typecheck: checkResult(json.typecheck),
      unit: checkResult(json.unit),
      nodeVersion:
        typeof json.nodeVersion === 'string' ? json.nodeVersion : undefined,
    };
  }
  const shards = latestByKind(
    files.keys(),
    new RegExp(
      `^canary-${escaped}-e2e-(?<kind>[a-z]+)-(?<attempt>\\d+)\\.json$`
    )
  );
  for (const [shard, { name }] of shards) {
    const json = read(name);
    reports.e2e[shard] = {
      result: checkResult(json.result),
      coverage: typeof json.coverage === 'string' ? json.coverage : undefined,
      failedStep:
        typeof json.failedStep === 'string' && json.failedStep
          ? json.failedStep
          : undefined,
      errorExcerpt:
        typeof json.errorExcerpt === 'string' && json.errorExcerpt
          ? json.errorExcerpt
          : undefined,
    };
  }
  return reports;
}

function checkResult(value: unknown): CheckResult {
  return value === 'pass' || value === 'fail' || value === 'skipped'
    ? value
    : 'infra-error';
}

export function readLabeledRows(file: string) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as LabeledRow);
}

function main() {
  const { values } = parseArgs({
    options: {
      digest: { type: 'string' },
      labeled: { type: 'string' },
      // downloaded digest artifacts; overrides --digest, --labeled and
      // --artifact with the highest attempt's
      'digest-dir': { type: 'string' },
      'canary-dir': { type: 'string' },
      trigger: { type: 'string', default: 'latest' },
      'run-url': { type: 'string' },
      artifact: { type: 'string' },
      prev: { type: 'string' },
      next: { type: 'string' },
      'no-tag': { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  });
  const out = values.out;
  if (!out) {
    throw new Error('--out is required');
  }
  const runUrl = values['run-url'] || undefined;
  const trigger = values.trigger === 'dispatch' ? 'dispatch' : 'latest';
  let digestPath = values.digest;
  let labeledPath = values.labeled;
  let artifactName = values.artifact;
  if (values['digest-dir']) {
    if (!values.next) {
      throw new Error('--digest-dir needs --next');
    }
    const chosen = selectDigestArtifact(values['digest-dir'], values.next);
    digestPath = chosen && path.join(chosen.dir, 'digest-input.json');
    labeledPath = chosen && path.join(chosen.dir, 'labeled.jsonl');
    artifactName = chosen?.name ?? artifactName;
  }
  const digest =
    digestPath && existsSync(digestPath)
      ? (JSON.parse(readFileSync(digestPath, 'utf8')) as DigestInput)
      : undefined;
  // The state step reads the digest this post was built from, and moves
  // state only when there was one.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `digest_loaded=${!!digest}\ndigest_path=${digest ? digestPath : ''}\n`
    );
  }
  const prev = digest?.prev ?? values.prev;
  const next = digest?.next ?? values.next;
  if (!prev || !next) {
    throw new Error('--prev and --next are required without --digest');
  }
  const canary = values['canary-dir']
    ? readCanaryReports(values['canary-dir'], next)
    : undefined;

  mkdirSync(out, { recursive: true });
  let post: Post;
  if (values['no-tag']) {
    post = noTagPost(prev, next, runUrl);
  } else if (!digest) {
    post = prepFailedPost({ prev, next, canary, runUrl });
  } else {
    const rows =
      labeledPath && existsSync(labeledPath)
        ? readLabeledRows(labeledPath)
        : undefined;
    const rendered = renderPost({
      digest,
      rows,
      canary,
      trigger,
      runUrl,
      artifactName,
    });
    post = rendered.post;
    if (rendered.sections) {
      const bullets = (list: { row: LabeledRow }[]) =>
        list.map(({ row }) => row.bullet);
      writeFileSync(
        path.join(out, 'sections.json'),
        JSON.stringify(
          {
            fallback: rendered.fallback,
            labeled: rendered.sections.labeled,
            total: rendered.sections.total,
            deprecations: bullets(rendered.sections.deprecations),
            check: bullets(rendered.sections.check),
            changes: bullets(rendered.sections.changes),
            mayFix: rendered.sections.mayFix.map(({ row, workaround, p }) => ({
              workaround,
              p,
              bullet: row.bullet,
            })),
            relevant: bullets(rendered.sections.relevant),
            dropped: rendered.sections.dropped.map(({ row }) => ({
              bullet: row.bullet,
              reason: row.labeled === false ? row.reason : undefined,
            })),
          },
          null,
          2
        ) + '\n'
      );
    }
  }
  // post.json is signed byte-for-byte as written; nothing reformats it later.
  writeFileSync(path.join(out, 'post.json'), JSON.stringify(post));
  writeFileSync(path.join(out, 'post.txt'), post.lines.join('\n') + '\n');
  process.stdout.write(post.lines.join('\n') + '\n');
}

if (import.meta.main) {
  main();
}
