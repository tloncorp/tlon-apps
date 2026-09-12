import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLIENT_ROOTS,
  Dependency,
  SourceLocation,
  extractClient,
} from './extract';
import { openTree } from './git';
import { loadOwnership, matchMark } from './marks';
import {
  Desk,
  MatchResult,
  PathRequest,
  SCRY_CARE,
  loadDesk,
  matchPath,
} from './match';
import { ProtocolDifference, compareProtocols } from './negotiate';

export interface Finding extends MatchResult {
  dependency: Dependency;
  /** Every call site that produces this request. */
  sites: SourceLocation[];
  /**
   * Listed in known-gaps.json: still reported, still MISSING, but does not
   * fail the run. Pre-existing debt only — see that file's header.
   */
  allowed?: KnownGap;
  /**
   * Every site making this request guards it on a capability, and the
   * complementary branch of that guard is served at this ref, so the guard has
   * somewhere to land. Reported, and does not fail the run.
   */
  fallback?: { coveredBy: string; guard?: string };
  /** Which of this request's sites are covered, and which still block. */
  coverage?: { covered: SourceLocation[]; blocking: SourceLocation[] };
}

export interface KnownGap {
  key: string;
  reason: string;
  broke_at?: string;
  issue?: string;
}

/**
 * One in-flight `agent:neg` bump. Rule (d) makes any protocol difference a hard
 * floor, which would otherwise mean the bump PR can never merge: it is the
 * change that creates the difference. An entry says the difference is the
 * intended one, so it is printed loudly and excluded from the exit code, and
 * the following release removes it once the bump is N-1.
 */
export interface ProtocolBump {
  agent: string;
  protocol: string;
  from: string;
  to: string;
  issue: string;
  note?: string;
}

export interface Report {
  clientRef: string;
  deskRef: string;
  protocolDifferences: ProtocolDifference[];
  /** Differences matching an allowed bump; reported, not counted. */
  allowedBumps: { difference: ProtocolDifference; bump: ProtocolBump }[];
  /** Entries that match nothing observed, so they may have gone stale. */
  staleBumps: ProtocolBump[];
  /** Gap entries that excused nothing in this run, for the same reason. */
  staleGaps: KnownGap[];
  findings: Finding[];
  counts: {
    found: number;
    missing: number;
    unverified: number;
    /** MISSING entries covered by known-gaps.json; excluded from `missing`. */
    allowed: number;
    /** MISSING branches whose sibling is served; excluded from `missing`. */
    fallback: number;
  };
}

export interface CheckOptions {
  clientRef: string;
  deskRef: string;
  /** Restrict extraction to these `file:line` call sites. */
  onlySites?: SourceLocation[];
}

const DESK_PATHS = ['desk', 'peru.yaml'];

/**
 * Pre-existing MISSING requests that do not fail the run. Read from the
 * checkout the checker runs in, not from either ref under test: it is a policy
 * file about *this* repo's debt.
 */
function loadPolicy(): { gaps?: KnownGap[]; protocolBumps?: ProtocolBump[] } {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(here, 'known-gaps.json'), 'utf8'));
}

export function loadKnownGaps(): Map<string, KnownGap> {
  return new Map((loadPolicy().gaps ?? []).map((g) => [g.key, g]));
}

export const loadProtocolBumps = (): ProtocolBump[] =>
  loadPolicy().protocolBumps ?? [];

/**
 * The one definition of "this MISSING fails the run". The exit code, the
 * counts, the report section and the fixtures all read it, so they cannot
 * drift into disagreeing about whether a covered fallback is a failure.
 */
export const isBlocking = (f: Finding) =>
  f.verdict === 'MISSING' && !f.allowed && !f.fallback;

/**
 * An observed difference is allowed only if a bump entry describes it exactly.
 *
 * Direction is not fixed: candidate-vs-N-1 sees the new version on the client
 * side and the old on the desk under test, while released-client-vs-candidate
 * sees exactly the reverse. Both are the same permitted transition, so the
 * entry matches either orientation — but only that pair of versions.
 */
export function matchBump(
  difference: ProtocolDifference,
  bumps: ProtocolBump[]
): ProtocolBump | undefined {
  const left = difference.clientDeskVersions.join();
  const right = difference.n1Versions.join();
  return bumps.find(
    (b) =>
      b.agent === difference.agent &&
      b.protocol === difference.protocol &&
      ((left === b.to && right === b.from) ||
        (left === b.from && right === b.to))
  );
}

/**
 * Identifiers that make a guard a *capability* guard — one that asks what the
 * desk supports, so its two branches are the same request written for two desk
 * versions. Taken from what the client actually spells:
 * `getActivitySupportsNotes`, `activityVersionSupportsNotes`,
 * `groupsVersionSupportsNotesSearch`, `REACTIONS_MIN_GROUPS_VERSION`,
 * `NOTES_ACTIVITY_MIN_GROUPS_VERSION`, `groupsVersion`.
 *
 * A branch on anything else — `whomIsDm(whom)`, `type === 'channel'` — chooses
 * between two requests the client makes in different situations, not between
 * two desks. Its sibling being served says nothing about the missing one.
 */
const CAPABILITY_GUARD =
  /\b(\w*MIN_GROUPS_VERSION|\w*[Ss]upports\w*|\w*[Cc]apab\w*|\w*[Dd]esk[Vv]ersion\w*|\w*[Gg]roups[Vv]ersion\w*|isDeskAtLeast\w*|hasFeature\w*)\b/;

const conjuncts = (guard?: string) =>
  (guard ?? '')
    .replace(/\s*\?\s*…\s*$/, '')
    .split(' && ')
    .map((c) => c.trim())
    .filter(Boolean);

const negate = (c: string) =>
  /^!\s*\(.*\)$/.test(c)
    ? c
        .replace(/^!\s*\(/, '')
        .replace(/\)$/, '')
        .trim()
    : `! (${c})`;

/**
 * Whether `found` runs exactly when `missing` does not, on a capability this
 * reader recognises. Requiring the complementary branch of the *same* guard is
 * what stops an unrelated served sibling on the same line from excusing a gap.
 */
export function complementsGuard(missing?: string, found?: string): boolean {
  const theirs = conjuncts(found);
  return conjuncts(missing).some(
    (c) => CAPABILITY_GUARD.test(c) && theirs.includes(negate(c))
  );
}

/**
 * A guarded branch whose complementary branch is served is the policy's
 * fallback exception, not a failure.
 *
 * Coverage is decided per *record*, not per request: one call site may guard
 * the request while another makes it unconditionally, and only the guarded one
 * is excused. A request is covered only when every site that would miss is.
 */
export function markCoveredFallbacks(
  findings: Finding[],
  grouped: Map<string, Dependency[]>
): void {
  const at = (s: SourceLocation) => `${s.file}:${s.line}`;
  const servedAt = new Map<string, { key: string; guard?: string }[]>();
  for (const finding of findings) {
    if (finding.verdict !== 'FOUND') continue;
    for (const dep of grouped.get(finding.dependency.key) ?? []) {
      const list = servedAt.get(at(dep.site)) ?? [];
      list.push({ key: finding.dependency.key, guard: dep.guard });
      servedAt.set(at(dep.site), list);
    }
  }
  for (const finding of findings) {
    if (finding.verdict !== 'MISSING') continue;
    const covered: SourceLocation[] = [];
    const blocking: SourceLocation[] = [];
    let coveredBy: string | undefined;
    let guard: string | undefined;
    for (const dep of grouped.get(finding.dependency.key) ?? []) {
      const sibling = (servedAt.get(at(dep.site)) ?? []).find((s) =>
        complementsGuard(dep.guard, s.guard)
      );
      if (!sibling) {
        blocking.push(dep.site);
        continue;
      }
      covered.push(dep.site);
      coveredBy ??= sibling.key;
      guard ??= dep.guard;
    }
    if (covered.length === 0) continue;
    finding.coverage = { covered, blocking };
    if (blocking.length === 0) {
      finding.fallback = { coveredBy: coveredBy!, guard };
    }
  }
}

export function toRequest(dep: Dependency): PathRequest | null {
  if (dep.app === null || dep.path === null) return null;
  return {
    app: dep.app,
    surface: dep.surface === 'scry' ? 'scry' : 'subscribe',
    known:
      dep.surface === 'scry'
        ? [SCRY_CARE, ...dep.path.known]
        : [...dep.path.known],
    unknownTail: dep.path.unknownTail,
  };
}

export function classify(
  dep: Dependency,
  desk: Desk,
  vendored: Set<string>
): MatchResult {
  // Raw eyre URLs and threads are not matcher targets — the N-1 policy defines
  // no ownership rule for either — so they are recorded as unresolved coverage
  // for layer 2 rather than dropped.
  if (dep.surface === 'http' || dep.surface === 'thread') {
    return {
      verdict: 'UNVERIFIED',
      rule: 'coverage',
      reason: `${dep.surface === 'http' ? 'raw eyre HTTP endpoint' : 'thread'} is outside layer 1`,
    };
  }
  if (dep.surface === 'poke')
    return matchMark(desk, vendored, dep.app, dep.mark);
  const request = toRequest(dep);
  if (request === null || dep.unresolved) {
    // P4 — an open value set (`/${feedVersion()}/…`) leaves no prefix to match
    // an arm against, so no arm can settle it.
    const openValueSet =
      dep.path !== null && dep.path.known.length === 0 && dep.path.unknownTail;
    return {
      verdict: 'UNVERIFIED',
      rule: openValueSet ? 'P4' : 'extraction',
      reason: dep.unresolved ?? 'extraction could not resolve app or path',
    };
  }
  return matchPath(desk, request);
}

/**
 * Whether a known-gap entry is about *this* request.
 *
 * An entry documents a request that was already broken at the baseline it
 * names. In the removal run the client ref shipped with its own desk, so a
 * request that desk serves is one the change under review is breaking now — and
 * an entry written about some older breakage must not excuse it. With no client
 * desk to compare against there is nothing to disprove, so the entry stands.
 */
export function gapApplies(
  dep: Dependency,
  clientDesk: Desk | null,
  vendored: Set<string> | null
): boolean {
  return (
    clientDesk === null ||
    classify(dep, clientDesk, vendored ?? new Set()).verdict !== 'FOUND'
  );
}

/**
 * Gap entries that excused nothing. Every one is debt someone is meant to pay
 * off, so an entry outliving the breakage it documents has to be noticed the
 * same way a stale protocol bump is.
 */
export const staleGapsIn = (gaps: KnownGap[], findings: Finding[]) =>
  gaps.filter((g) => !findings.some((f) => f.allowed === g));

export function runCheck(options: CheckOptions): Report {
  const clientTree = openTree(options.clientRef, CLIENT_ROOTS);
  const deskTree = openTree(options.deskRef, DESK_PATHS);
  // The desk that ships alongside the client ref: it supplies the protocol
  // comparison, and the one ownership set all three release runs share.
  const clientDeskTree =
    options.clientRef === options.deskRef
      ? deskTree
      : openTree(options.clientRef, DESK_PATHS);

  try {
    const desk = loadDesk(deskTree, options.deskRef, clientDeskTree);
    // Vendored availability is a property of the desk under test: a mark
    // dropped from *its* pick list without a local mar file is a removal, and
    // reading the client ref's older list would report it as unverifiable.
    const vendored = loadOwnership(deskTree);
    const allowlist = loadKnownGaps();

    let deps = extractClient(clientTree);
    if (options.onlySites) {
      const wanted = new Set(
        options.onlySites.map((s) => `${s.file}:${s.line}`)
      );
      deps = deps.filter((d) => wanted.has(`${d.site.file}:${d.site.line}`));
    }

    // Collapse identical requests, keeping every call site that produced one.
    const grouped = new Map<string, Dependency[]>();
    for (const dep of deps)
      grouped.set(dep.key, [...(grouped.get(dep.key) ?? []), dep]);

    const clientDesk =
      clientDeskTree === deskTree
        ? null
        : loadDesk(clientDeskTree, options.clientRef);
    const vendoredThere = clientDesk ? loadOwnership(clientDeskTree) : null;

    const findings: Finding[] = [];
    for (const group of grouped.values()) {
      const result = classify(group[0], desk, vendored);
      findings.push({
        ...result,
        dependency: group[0],
        sites: group.map((d) => d.site),
        ...(result.verdict === 'MISSING' &&
        allowlist.has(group[0].key) &&
        gapApplies(group[0], clientDesk, vendoredThere)
          ? { allowed: allowlist.get(group[0].key) }
          : {}),
      });
    }
    markCoveredFallbacks(findings, grouped);
    findings.sort((a, b) => a.dependency.key.localeCompare(b.dependency.key));

    const bumps = loadProtocolBumps();
    const observed = compareProtocols(clientDeskTree, deskTree);
    const allowedBumps: Report['allowedBumps'] = [];
    const protocolDifferences: ProtocolDifference[] = [];
    for (const difference of observed) {
      const bump = matchBump(difference, bumps);
      if (bump) allowedBumps.push({ difference, bump });
      else protocolDifferences.push(difference);
    }

    const count = (p: (f: Finding) => boolean) => findings.filter(p).length;
    return {
      clientRef: options.clientRef,
      deskRef: options.deskRef,
      protocolDifferences,
      allowedBumps,
      staleBumps: bumps.filter((b) => !allowedBumps.some((a) => a.bump === b)),
      // A partial scan cannot tell a stale entry from an unvisited one.
      staleGaps: options.onlySites
        ? []
        : staleGapsIn([...allowlist.values()], findings),
      findings,
      counts: {
        found: count((f) => f.verdict === 'FOUND'),
        missing: count(isBlocking),
        unverified: count((f) => f.verdict === 'UNVERIFIED'),
        allowed: count((f) => f.verdict === 'MISSING' && Boolean(f.allowed)),
        fallback: count(
          (f) => f.verdict === 'MISSING' && !f.allowed && Boolean(f.fallback)
        ),
      },
    };
  } finally {
    clientTree.dispose();
    if (clientDeskTree !== deskTree) clientDeskTree.dispose();
    deskTree.dispose();
  }
}

// --- reporting --------------------------------------------------------------

const FAILURE_TEXT = {
  crash: 'the agent crashes (watch nack / peek 500)',
  empty: 'the agent returns an empty result',
  unknown: 'failure mode not determined',
};

function describe(finding: Finding): string[] {
  const dep = finding.dependency;
  const lines = [`  ${dep.key}`, `    why:   ${finding.reason}`];
  if (finding.evidence) lines.push(`    desk:  ${finding.evidence}`);
  if (finding.failureMode && finding.verdict === 'MISSING') {
    lines.push(`    fails: ${FAILURE_TEXT[finding.failureMode]}`);
  }
  if (dep.guard) lines.push(`    guard: ${dep.guard}`);
  const shown = finding.sites.slice(0, 6).map((s) => `${s.file}:${s.line}`);
  const more = finding.sites.length - shown.length;
  lines.push(
    `    sites: ${shown.join(', ')}${more > 0 ? ` (+${more} more)` : ''}`
  );
  if (finding.verdict === 'UNVERIFIED') lines.push(`    text:  ${dep.text}`);
  if (finding.fallback) {
    lines.push(`    covers N-1: ${finding.fallback.coveredBy}`);
  } else if (finding.coverage) {
    // Guarded at some sites and not at others: say which sites still block, so
    // the fix is "guard these too", not "why is my fallback ignored?".
    const at = (l: SourceLocation[]) =>
      l.map((s) => `${s.file}:${s.line}`).join(', ');
    lines.push(`    covered at: ${at(finding.coverage.covered)}`);
    lines.push(`    blocks at:  ${at(finding.coverage.blocking)}`);
  }
  if (finding.allowed) {
    const { reason, broke_at, issue } = finding.allowed;
    lines.push(`    known: ${reason}`);
    if (broke_at || issue) {
      lines.push(
        `    debt:  broke at ${broke_at ?? '?'}, tracked by ${issue ?? '?'}`
      );
    }
  }
  return lines;
}

export function formatReport(report: Report): string {
  const out = [
    `desk-compat: client ${report.clientRef} vs desk ${report.deskRef}`,
    '',
  ];
  if (report.protocolDifferences.length > 0) {
    out.push('NEGOTIATION PROTOCOL MISMATCH (blocks the pair outright)');
    for (const d of report.protocolDifferences) {
      out.push(
        `  %${d.agent} ~.${d.protocol}: client desk [${d.clientDeskVersions.join(', ') || '-'}] vs desk under test [${d.n1Versions.join(', ') || '-'}]`
      );
    }
    out.push(
      '  negotiate refuses a pair that disagrees on a protocol, whatever the paths say.',
      ''
    );
  } else if (report.allowedBumps.length > 0) {
    out.push('negotiation protocols: no blocking protocol difference', '');
  } else out.push('negotiation protocols: no version difference', '');

  for (const { difference: d, bump } of report.allowedBumps) {
    out.push(
      `ALLOWED PROTOCOL BUMP: %${d.agent} ~.${d.protocol} ${bump.from} -> ${bump.to}, tracked by ${bump.issue}`,
      ...(bump.note ? [`  ${bump.note}`] : []),
      '  N-1 support is suspended for this protocol until the bump becomes N-1.',
      ''
    );
  }
  for (const bump of report.staleBumps) {
    out.push(
      `warning: known-gaps.json still allows the %${bump.agent} ~.${bump.protocol} ` +
        `${bump.from} -> ${bump.to} bump (${bump.issue}), but this pair shows no such ` +
        'difference. Remove the entry once the bump is N-1.',
      ''
    );
  }
  for (const gap of report.staleGaps) {
    out.push(
      `warning: known-gaps.json still excuses ${gap.key} (${gap.issue ?? 'no issue'}), ` +
        'but this run reports no such MISSING. Remove the entry.',
      ''
    );
  }

  const section = (title: string, keep: (f: Finding) => boolean) => {
    const findings = report.findings.filter(keep);
    if (findings.length === 0) return;
    out.push(
      `${title} (${findings.length})`,
      ...findings.flatMap(describe),
      ''
    );
  };
  section('MISSING', isBlocking);
  section(
    'MISSING on this branch, but a sibling branch is served',
    (f) => Boolean(f.fallback) && !f.allowed
  );
  section('MISSING but allowed by known-gaps.json', (f) => Boolean(f.allowed));
  section('UNVERIFIED', (f) => f.verdict === 'UNVERIFIED');

  const { found, missing, unverified, allowed, fallback } = report.counts;
  const sites = report.findings.reduce((n, f) => n + f.sites.length, 0);
  out.push(
    `summary: ${found} FOUND, ${missing} MISSING, ${unverified} UNVERIFIED, ` +
      `${fallback} covered fallback(s), ${allowed} known gap(s) over ` +
      `${report.findings.length} distinct requests from ${sites} call sites`
  );
  out.push(
    report.protocolDifferences.length > 0
      ? 'result: FAIL (negotiation protocol difference)'
      : missing > 0
        ? 'result: FAIL'
        : 'result: PASS (UNVERIFIED entries do not fail the run)'
  );
  return out.join('\n');
}

/** 0 = no MISSING; 1 = one or more; 2 = internal error (set by the CLI). */
export const exitCodeFor = (report: Report) =>
  report.counts.missing > 0 || report.protocolDifferences.length > 0 ? 1 : 0;
