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
}

export interface KnownGap {
  key: string;
  reason: string;
  broke_at?: string;
  issue?: string;
}

export interface Report {
  clientRef: string;
  deskRef: string;
  protocolDifferences: ProtocolDifference[];
  findings: Finding[];
  counts: {
    found: number;
    missing: number;
    unverified: number;
    /** MISSING entries covered by known-gaps.json; excluded from `missing`. */
    allowed: number;
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
export function loadKnownGaps(): Map<string, KnownGap> {
  const here = dirname(fileURLToPath(import.meta.url));
  const parsed = JSON.parse(
    readFileSync(join(here, 'known-gaps.json'), 'utf8')
  ) as {
    gaps?: KnownGap[];
  };
  return new Map((parsed.gaps ?? []).map((g) => [g.key, g]));
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
    const desk = loadDesk(deskTree, options.deskRef);
    const vendored = loadOwnership(clientDeskTree);
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
    findings.sort((a, b) => a.dependency.key.localeCompare(b.dependency.key));

    const count = (p: (f: Finding) => boolean) => findings.filter(p).length;
    return {
      clientRef: options.clientRef,
      deskRef: options.deskRef,
      protocolDifferences: compareProtocols(clientDeskTree, deskTree),
      findings,
      counts: {
        found: count((f) => f.verdict === 'FOUND'),
        missing: count((f) => f.verdict === 'MISSING' && !f.allowed),
        unverified: count((f) => f.verdict === 'UNVERIFIED'),
        allowed: count((f) => f.verdict === 'MISSING' && Boolean(f.allowed)),
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

  const section = (title: string, keep: (f: Finding) => boolean) => {
    const findings = report.findings.filter(keep);
    if (findings.length === 0) return;
    out.push(
      `${title} (${findings.length})`,
      ...findings.flatMap(describe),
      ''
    );
  };
  section('MISSING', (f) => f.verdict === 'MISSING' && !f.allowed);
  section('MISSING but allowed by known-gaps.json', (f) => Boolean(f.allowed));
  section('UNVERIFIED', (f) => f.verdict === 'UNVERIFIED');

  const { found, missing, unverified, allowed } = report.counts;
  const sites = report.findings.reduce((n, f) => n + f.sites.length, 0);
  out.push(
    `summary: ${found} FOUND, ${missing} MISSING, ${unverified} UNVERIFIED, ${allowed} known gap(s) ` +
      `over ${report.findings.length} distinct requests from ${sites} call sites`
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
