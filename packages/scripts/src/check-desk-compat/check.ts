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
   * A sibling branch at the same call site is served at this ref, so the guard
   * has somewhere to land. Reported, and does not fail the run.
   */
  fallback?: { coveredBy: string; guard?: string };
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

/** An observed difference is allowed only if a bump entry describes it exactly. */
export function matchBump(
  difference: ProtocolDifference,
  bumps: ProtocolBump[]
): ProtocolBump | undefined {
  return bumps.find(
    (b) =>
      b.agent === difference.agent &&
      b.protocol === difference.protocol &&
      difference.n1Versions.join() === b.from &&
      difference.clientDeskVersions.join() === b.to
  );
}

/**
 * A guarded branch whose sibling is served is the policy's fallback exception,
 * not a failure. Conditional branches are never unioned — each is its own
 * record — so a fallback shows up as two records sharing one call site.
 */
export function markCoveredFallbacks(findings: Finding[]): void {
  const foundBySite = new Map<string, string>();
  for (const finding of findings) {
    if (finding.verdict !== 'FOUND') continue;
    for (const site of finding.sites) {
      foundBySite.set(`${site.file}:${site.line}`, finding.dependency.key);
    }
  }
  for (const finding of findings) {
    if (finding.verdict !== 'MISSING' || !finding.dependency.guard) continue;
    for (const site of finding.sites) {
      const coveredBy = foundBySite.get(`${site.file}:${site.line}`);
      if (coveredBy) {
        finding.fallback = { coveredBy, guard: finding.dependency.guard };
        break;
      }
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

    const findings: Finding[] = [];
    for (const group of grouped.values()) {
      const result = classify(group[0], desk, vendored);
      findings.push({
        ...result,
        dependency: group[0],
        sites: group.map((d) => d.site),
        ...(result.verdict === 'MISSING' && allowlist.has(group[0].key)
          ? { allowed: allowlist.get(group[0].key) }
          : {}),
      });
    }
    markCoveredFallbacks(findings);
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
    const excused = (f: Finding) => Boolean(f.allowed || f.fallback);
    return {
      clientRef: options.clientRef,
      deskRef: options.deskRef,
      protocolDifferences,
      allowedBumps,
      staleBumps: bumps.filter((b) => !allowedBumps.some((a) => a.bump === b)),
      findings,
      counts: {
        found: count((f) => f.verdict === 'FOUND'),
        missing: count((f) => f.verdict === 'MISSING' && !excused(f)),
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

  const section = (title: string, keep: (f: Finding) => boolean) => {
    const findings = report.findings.filter(keep);
    if (findings.length === 0) return;
    out.push(
      `${title} (${findings.length})`,
      ...findings.flatMap(describe),
      ''
    );
  };
  section(
    'MISSING',
    (f) => f.verdict === 'MISSING' && !f.allowed && !f.fallback
  );
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
