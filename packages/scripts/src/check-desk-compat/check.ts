import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLIENT_ROOTS,
  Dependency,
  SourceLocation,
  extractClient,
} from './extract';
import { Tree, openTree } from './git';
import {
  Desk,
  MatchResult,
  PathRequest,
  SCRY_CARE,
  Verdict,
  loadDesk,
  loadOwnership,
  matchMark,
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
  /** A few lines of whatever the verdict turned on, for the report. */
  excerpt?: string[];
  /**
   * Set when a `MISSING` request is guarded at some call sites and not at
   * others. The unguarded ones are what keeps it blocking.
   */
  coverage?: { guarded: SourceLocation[]; blocking: SourceLocation[] };
}

export interface KnownGap {
  key: string;
  reason: string;
  broke_at?: string;
  issue?: string;
}

/**
 * One in-flight `agent:neg` bump. A protocol difference is a hard floor, which
 * would otherwise mean the bump PR can never merge: it is the change that
 * creates the difference. An entry says the difference is the intended one, so
 * it is printed loudly and excluded from the exit code, and the following
 * release removes it once the bump is N-1.
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
  counts: Record<Lowercase<Verdict> | 'allowed', number>;
}

export interface CheckOptions {
  clientRef: string;
  deskRef: string;
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
 * The one definition of "this finding fails the run". The exit code, the
 * counts, both report formats and the fixtures all read it, so they cannot
 * drift into disagreeing.
 */
export const isBlocking = (f: Finding) => f.verdict === 'MISSING' && !f.allowed;

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
 * versions.
 *
 * A `MISSING` request behind one of these becomes `GUARDED`: reported for a
 * human to judge against N-1's arms, never blocking. The checker does not try
 * to prove the other branch is served — that analysis was more machinery than
 * signal — so a `GUARDED` entry is a question, not an answer.
 *
 * This is a **textual** test over the guard's source, and it is credulous in
 * both directions on purpose. It does not resolve identifiers, so
 * `type === 'groupsVersion'` reads as a capability guard; it does not read
 * polarity, so it cannot tell `supportsNotes` from `!supportsNotes`; and it
 * does not know whether the guard is correct. A false positive here costs a
 * blocking `MISSING` demoted to a line a reviewer must read — which is why the
 * checklist and AGENTS.md both say to read every one.
 *
 * A branch on anything else — `whomIsDm(whom)`, `type === 'channel'` — chooses
 * between two requests the client makes in different situations, not between
 * two desks, and stays blocking.
 */
export const CAPABILITY_GUARD =
  /\b(\w*MIN_GROUPS_VERSION|getActivitySupportsNotes|activityVersionSupportsNotes|groupsVersionSupportsNotesSearch|groupsVersion)\b/;

export const isCapabilityGuard = (guard?: string) =>
  guard !== undefined && CAPABILITY_GUARD.test(guard);

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

/**
 * The verdict for one request, across every call site that makes it.
 *
 * The match itself is the same at every site — the key fixes the app and the
 * path or mark — but the *guard* is not, so the promotion to `GUARDED` is
 * decided over the whole group: one unguarded occurrence means the client
 * sends this to a desk that cannot take it, whatever the others do. Deciding
 * it from whichever occurrence happened to be extracted first made the verdict
 * depend on file order.
 */
export function classify(
  deps: Dependency[],
  desk: Desk,
  vendored: Set<string>
): MatchResult & Pick<Finding, 'coverage'> {
  const dep = deps[0];
  const decide = (): MatchResult => {
    // Raw eyre URLs and threads are not matcher targets — the N-1 policy
    // defines no ownership rule for either — so they are recorded as
    // unresolved coverage for a human rather than dropped.
    if (dep.surface === 'http' || dep.surface === 'thread') {
      return {
        verdict: 'UNVERIFIED',
        rule: 'coverage',
        reason: `${dep.surface === 'http' ? 'raw eyre HTTP endpoint' : 'thread'} is outside what this checker reads`,
      };
    }
    if (dep.surface === 'poke')
      return matchMark(desk, vendored, dep.app, dep.mark);
    const request = toRequest(dep);
    if (request === null || dep.unresolved) {
      return {
        verdict: 'UNVERIFIED',
        rule: 'extraction',
        reason: dep.unresolved ?? 'extraction could not resolve app or path',
      };
    }
    return matchPath(desk, request);
  };
  const result = decide();
  if (result.verdict !== 'MISSING') return result;
  const guarded = deps.filter((d) => isCapabilityGuard(d.guard));
  const blocking = deps.filter((d) => !isCapabilityGuard(d.guard));
  if (blocking.length === 0) return { ...result, verdict: 'GUARDED' };
  if (guarded.length === 0) return result;
  return {
    ...result,
    coverage: {
      guarded: guarded.map((d) => d.site),
      blocking: blocking.map((d) => d.site),
    },
  };
}

export function runCheck(options: CheckOptions): Report {
  // Opened inside the try, and each remembered as it is: a second or third
  // open that throws would otherwise leave the earlier temp directories on
  // disk for the life of the process.
  const opened: Tree[] = [];
  const open = (ref: string, paths: string[]) => {
    const tree = openTree(ref, paths);
    opened.push(tree);
    return tree;
  };
  try {
    const clientTree = open(options.clientRef, CLIENT_ROOTS);
    const deskTree = open(options.deskRef, DESK_PATHS);
    // The desk that ships alongside the client ref: it supplies the protocol
    // comparison, and tells a removal from an agent that was never ours.
    const clientDeskTree =
      options.clientRef === options.deskRef
        ? deskTree
        : open(options.clientRef, DESK_PATHS);

    const desk = loadDesk(deskTree, options.deskRef, clientDeskTree);
    // Vendored availability is a property of the desk under test: a mark
    // dropped from *its* pick list without a local mar file is a removal, and
    // reading the client ref's older list would report it as unverifiable.
    const vendored = loadOwnership(deskTree);
    const allowlist = loadKnownGaps();

    const deps = extractClient(clientTree);

    // Collapse identical requests, keeping every call site that produced one.
    const grouped = new Map<string, Dependency[]>();
    for (const dep of deps)
      grouped.set(dep.key, [...(grouped.get(dep.key) ?? []), dep]);

    const findings: Finding[] = [];
    for (const group of grouped.values()) {
      const result = classify(group, desk, vendored);
      findings.push({
        ...result,
        dependency: group[0],
        sites: group.map((d) => d.site),
        excerpt: excerpt(deskTree, result),
        ...(result.verdict === 'MISSING' && allowlist.has(group[0].key)
          ? { allowed: allowlist.get(group[0].key) }
          : {}),
      });
    }
    findings.sort((a, b) => a.dependency.key.localeCompare(b.dependency.key));

    const bumps = loadProtocolBumps();
    const allowedBumps: Report['allowedBumps'] = [];
    const protocolDifferences: ProtocolDifference[] = [];
    for (const difference of compareProtocols(clientDeskTree, deskTree)) {
      const bump = matchBump(difference, bumps);
      if (bump) allowedBumps.push({ difference, bump });
      else protocolDifferences.push(difference);
    }

    const used = new Set(
      findings.filter((f) => f.allowed).map((f) => f.dependency.key)
    );
    const count = (p: (f: Finding) => boolean) => findings.filter(p).length;
    return {
      clientRef: options.clientRef,
      deskRef: options.deskRef,
      protocolDifferences,
      allowedBumps,
      // A candidate-vs-itself run compares a tree with itself and can never
      // show a protocol difference, so every entry would look stale.
      staleBumps:
        options.clientRef === options.deskRef
          ? []
          : bumps.filter((b) => !allowedBumps.some((a) => a.bump === b)),
      staleGaps: [...allowlist.values()].filter((g) => !used.has(g.key)),
      findings,
      counts: {
        matched: count((f) => f.verdict === 'MATCHED'),
        wildcard: count((f) => f.verdict === 'WILDCARD'),
        missing: count(isBlocking),
        guarded: count((f) => f.verdict === 'GUARDED'),
        unverified: count((f) => f.verdict === 'UNVERIFIED'),
        allowed: used.size,
      },
    };
  } finally {
    for (const tree of opened) tree.dispose();
  }
}

// --- reporting --------------------------------------------------------------

const FAILURE_TEXT: Record<string, string> = {
  crash: 'the agent crashes (watch nack / peek 500)',
  empty: 'the agent returns an empty result',
  'not-running': 'the agent is not started, so nothing answers',
};

/** Backticks in a quoted arm would end the fence they sit in. */
const fence = (lines: string[]) => {
  const ticks = '`'.repeat(
    Math.max(3, ...lines.map((l) => (/(`+)/.exec(l)?.[1].length ?? 0) + 1))
  );
  return [`${ticks}hoon`, ...lines, ticks];
};

/**
 * Every site for a verdict a human must act on; a capped list with an explicit
 * remainder for the rest, since `UNVERIFIED` entries run to dozens of sites
 * and a silent `.slice()` reads as if that were all of them.
 */
function siteList(f: Finding, cap = 8): string {
  const all = f.sites.map((s) => `\`${at(s)}\``);
  if (f.verdict === 'MISSING' || f.verdict === 'GUARDED' || all.length <= cap) {
    return all.join(', ');
  }
  return `${all.slice(0, cap).join(', ')} (+${all.length - cap} more)`;
}

const at = (s: SourceLocation) => `${s.file}:${s.line}`;

/**
 * A few lines of whatever the verdict turned on, read while the desk tree is
 * still open so the report can be rendered from the `Report` alone.
 */
function excerpt(deskTree: Tree, r: MatchResult, lines = 3): string[] {
  if (!r.source) return [];
  const source = deskTree.readFile(r.source.file);
  if (source === null) return [];
  // Comment-only and blank lines are skipped: a dispatcher header is often
  // followed by several, and the point of the excerpt is to show a reviewer
  // the arms next to it.
  return source
    .split('\n')
    .slice(Math.max(0, r.source.line - 1), Math.max(0, r.source.line - 1) + 40)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '' && l.trim() !== '::')
    .slice(0, lines);
}

const SECTIONS: { verdict: Verdict; title: string; blurb: string }[] = [
  {
    verdict: 'MISSING',
    title: 'MISSING',
    blurb:
      'No arm, mar file, agent file or bill entry can take this request. ' +
      'These fail the run.',
  },
  {
    verdict: 'GUARDED',
    title: 'GUARDED',
    blurb:
      'Missing, but written behind a capability guard, so the client may ' +
      'never send it to this desk. Check the guard against the N-1 desk.',
  },
  {
    verdict: 'WILDCARD',
    title: 'WILDCARD',
    blurb:
      'An arm matches only by swallowing the tail with `*` or by consuming a ' +
      'named mold. That the pattern accepts the pole says little about ' +
      'whether the body answers.',
  },
  {
    verdict: 'UNVERIFIED',
    title: 'UNVERIFIED',
    blurb: 'The checker could not decide. Each entry names why.',
  },
];

export function formatReport(report: Report): string {
  const out: string[] = [
    `desk-compat: client ${report.clientRef} vs desk ${report.deskRef}`,
  ];
  const line = (s: string) => out.push(s);

  if (report.protocolDifferences.length > 0) {
    line('\nNEGOTIATION PROTOCOL MISMATCH (blocks the pair outright)');
    for (const d of report.protocolDifferences) {
      line(
        `  %${d.agent} ~.${d.protocol}: client desk [${d.clientDeskVersions.join(' ')}] vs desk under test [${d.n1Versions.join(' ')}]`
      );
    }
    line('  negotiate refuses a pair that disagrees on a protocol.');
  }
  for (const { difference: d, bump } of report.allowedBumps) {
    line(
      `\nALLOWED PROTOCOL BUMP (${bump.issue})\n  %${d.agent} ~.${d.protocol}: ${bump.from} -> ${bump.to}` +
        `${bump.note ? `\n  ${bump.note}` : ''}`
    );
  }
  for (const b of report.staleBumps) {
    line(
      `\nWARNING: protocolBumps entry %${b.agent} ~.${b.protocol} ${b.from}->${b.to} (${b.issue}) matches no observed difference.`
    );
  }
  for (const g of report.staleGaps) {
    line(
      `\nWARNING: known-gaps entry "${g.key}" excused nothing in this run; delete it.`
    );
  }

  for (const section of SECTIONS) {
    const rows = report.findings.filter(
      (f) => f.verdict === section.verdict && !f.allowed
    );
    if (rows.length === 0) continue;
    line(`\n${section.title} (${rows.length})`);
    for (const f of rows) {
      line(`  ${f.dependency.key}`);
      line(`    why:   ${f.reason}`);
      if (f.evidence) line(`    desk:  ${f.evidence}`);
      if (f.failureMode) line(`    fails: ${FAILURE_TEXT[f.failureMode]}`);
      if (f.dependency.guard) line(`    guard: ${f.dependency.guard}`);
      line(`    sites: ${f.sites.slice(0, 6).map(at).join(', ')}`);
      if (f.coverage) {
        line(
          `    also:  guarded at ${f.coverage.guarded.length} site(s); blocking at ${f.coverage.blocking.map(at).join(', ')}`
        );
      }
    }
  }

  const allowed = report.findings.filter((f) => f.allowed);
  if (allowed.length > 0) {
    line(`\nMISSING but allowed by known-gaps.json (${allowed.length})`);
    for (const f of allowed) {
      line(`  ${f.dependency.key}`);
      line(`    known: ${f.allowed!.reason}`);
      line(
        `    debt:  broke at ${f.allowed!.broke_at ?? '?'}, tracked by ${f.allowed!.issue ?? '?'}`
      );
    }
  }

  line(
    `\nsummary: ${report.counts.matched} MATCHED, ${report.counts.wildcard} WILDCARD, ` +
      `${report.counts.missing} MISSING, ${report.counts.guarded} GUARDED, ` +
      `${report.counts.unverified} UNVERIFIED, ${report.counts.allowed} known gap(s) ` +
      `over ${report.findings.length} distinct requests`
  );
  line(
    'note:    MATCHED means an arm pattern accepts the pole, not a promise the agent answers.'
  );
  line(exitCodeFor(report) === 0 ? 'result:  PASS' : 'result:  FAIL');
  return out.join('\n');
}

/** The PR-comment form: the same findings, as a reviewer's worklist. */
export function markdownReport(report: Report): string {
  const out: string[] = [
    `### Desk compatibility: \`${report.clientRef}\` against desk \`${report.deskRef}\``,
    '',
    `${report.counts.matched} matched · ${report.counts.wildcard} wildcard · ` +
      `**${report.counts.missing} missing** · ${report.counts.guarded} guarded · ` +
      `${report.counts.unverified} unverified · ${report.counts.allowed} known gap(s)`,
    '',
    '`MATCHED` means an arm pattern accepts the pole — not that the agent answers.',
  ];
  if (report.protocolDifferences.length > 0) {
    out.push('', '#### Negotiation protocol mismatch');
    for (const d of report.protocolDifferences) {
      out.push(
        `- \`%${d.agent}\` \`~.${d.protocol}\`: client desk [${d.clientDeskVersions.join(' ')}] vs desk under test [${d.n1Versions.join(' ')}]`
      );
    }
  }
  for (const { difference: d, bump } of report.allowedBumps) {
    out.push(
      '',
      `#### Allowed protocol bump (${bump.issue})`,
      `- \`%${d.agent}\` \`~.${d.protocol}\`: ${bump.from} → ${bump.to}`
    );
  }

  for (const section of SECTIONS) {
    const rows = report.findings.filter(
      (f) => f.verdict === section.verdict && !f.allowed
    );
    if (rows.length === 0) continue;
    out.push('', `#### ${section.title} (${rows.length})`, '', section.blurb);
    for (const f of rows) {
      out.push('', `**\`${f.dependency.key}\`** — ${f.reason}`);
      if (f.dependency.guard) out.push(`- guard: \`${f.dependency.guard}\``);
      if (f.failureMode) out.push(`- fails: ${FAILURE_TEXT[f.failureMode]}`);
      out.push(`- sites: ${siteList(f)}`);
      if (f.coverage) {
        out.push(
          `- guarded at ${f.coverage.guarded.length} site(s), but still sent unguarded from ` +
            f.coverage.blocking.map((s) => `\`${at(s)}\``).join(', ')
        );
      }
      const lines = f.excerpt ?? [];
      if (lines.length > 0) {
        out.push(
          `- ${f.verdict === 'MATCHED' || f.verdict === 'WILDCARD' ? 'arm' : 'nearest dispatcher'}: \`${f.source!.file}:${f.source!.line}\``,
          '',
          ...fence(lines)
        );
      } else if (f.evidence) out.push(`- desk: \`${f.evidence}\``);
    }
  }

  const allowed = report.findings.filter((f) => f.allowed);
  if (allowed.length > 0) {
    out.push(
      '',
      `#### Known gaps (allowed, ${allowed.length})`,
      '',
      'Already broken before this change, and tracked. Not a free pass: a new',
      'MISSING needs its desk change to ship first.'
    );
    for (const f of allowed) {
      out.push(
        '',
        `**\`${f.dependency.key}\`** — ${f.reason}`,
        `- sites: ${siteList(f)}`,
        `- broke at \`${f.allowed!.broke_at ?? '?'}\`, tracked by ${f.allowed!.issue ?? '?'}`,
        `- ${f.allowed!.reason}`
      );
    }
  }

  for (const g of report.staleGaps) {
    out.push(
      '',
      `> **Warning** the known-gaps entry \`${g.key}\` excused nothing in this run; delete it.`
    );
  }
  for (const b of report.staleBumps) {
    out.push(
      '',
      `> **Warning** the protocolBumps entry \`%${b.agent} ~.${b.protocol} ${b.from}->${b.to}\` (${b.issue}) matches no observed difference; delete it.`
    );
  }
  return out.join('\n');
}

export const exitCodeFor = (report: Report) =>
  report.findings.some(isBlocking) || report.protocolDifferences.length > 0
    ? 1
    : 0;
