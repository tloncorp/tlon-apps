import { Tree } from './git';
import {
  Arm,
  Dispatcher,
  Elem,
  HoonArmRange,
  VersionInjection,
  indexArms,
  parseDispatcher,
  rewritesSubject,
  stripComments,
  versionInjection,
} from './hoon';

/**
 * What the checker decided about one request.
 *
 * There is no `SERVED`. `MATCHED` says an arm exists whose pattern accepts the
 * pole; whether that arm's body then answers is not something a static read of
 * the dispatcher can establish, and the docs say so in as many words.
 * `GUARDED` is applied a layer up, in `check.ts`.
 */
export type Verdict =
  | 'MISSING'
  | 'MATCHED'
  | 'WILDCARD'
  | 'UNVERIFIED'
  | 'GUARDED';

/** Which rule reached the verdict. */
export type Rule =
  | 'prefix'
  | 'suffix'
  | 'marks'
  | 'removal'
  | 'negotiation'
  | 'extraction'
  | 'coverage';

/** How the desk fails when nothing answers. */
export type FailureMode = 'crash' | 'empty' | 'not-running' | 'unknown';

export interface MatchResult {
  verdict: Verdict;
  rule: Rule;
  reason: string;
  /** Desk-side evidence: the arm or file the verdict turned on. */
  evidence?: string;
  /** Where that evidence lives, so the report can quote a few lines of it. */
  source?: { file: string; line: number };
  failureMode?: FailureMode;
}

export interface PathRequest {
  app: string;
  surface: 'scry' | 'subscribe';
  /** Leading segments known exactly. Scries carry the care (`x`) first. */
  known: string[];
  unknownTail: boolean;
}

/** Eyre's `/~/scry/<app><path>` always asks for the `x` care. */
export const SCRY_CARE = 'x';

interface Agent {
  name: string;
  file: string;
  lines: string[];
  arms: Map<string, HoonArmRange>;
  peek: Surface;
  watch: Surface;
}

interface Surface {
  dispatcher: Dispatcher | null;
  injection: VersionInjection | null;
  /** The subject is rewritten before dispatch, so no absence can be claimed. */
  rewritten: boolean;
}

export interface Desk {
  ref: string;
  tree: Tree;
  bill: Set<string>;
  marFiles: Set<string>;
  hasApp(app: string): boolean;
  agent(app: string): Agent | null;
  /**
   * The desk that shipped with the *client* ref, when there is one. Comparing
   * against it is the only way to tell a removal from an agent that was never
   * ours: an app, a bill entry or a mar file present there and absent here is
   * something this desk dropped.
   */
  clientHasApp(app: string): boolean;
  clientBilled(app: string): boolean;
  clientHasMark(candidates: string[]): boolean;
}

/**
 * The agents `desk.bill` starts. Comments are stripped first: commenting the
 * name out is how an agent leaves the bill, and reading `:: %activity` as an
 * entry would hide exactly the removal this check exists to catch.
 */
const billIn = (tree: Tree) =>
  new Set(
    Array.from(
      stripComments((tree.readFile('desk/desk.bill') ?? '').split('\n'))
        .join('\n')
        .matchAll(/%([a-z][a-z0-9-]*)/g)
    ).map((m) => m[1])
  );

/** Agents are parsed lazily; a run touches a handful of the 27. */
function agentLoader(tree: Tree): (app: string) => Agent | null {
  const cache = new Map<string, Agent | null>();
  return (app) => {
    if (!cache.has(app)) {
      const file = `desk/app/${app}.hoon`;
      const source = tree.readFile(file);
      // Stripped once, here: this is the only place an agent file becomes
      // lines, so nothing downstream can read a comment as code.
      const lines = source === null ? null : stripComments(source.split('\n'));
      const arms = lines ? indexArms(lines) : null;
      cache.set(
        app,
        lines && arms
          ? {
              name: app,
              file,
              lines,
              arms,
              peek: resolveSurface(lines, arms, 'on-peek'),
              watch: resolveSurface(lines, arms, 'on-watch'),
            }
          : null
      );
    }
    return cache.get(app)!;
  };
}

export function loadDesk(tree: Tree, ref: string, clientDesk?: Tree): Desk {
  const bill = billIn(tree);
  const clientBill = clientDesk ? billIn(clientDesk) : null;
  const clientMars = clientDesk
    ? new Set(clientDesk.list('desk/mar', (p) => p.endsWith('.hoon')))
    : null;
  return {
    ref,
    tree,
    bill,
    marFiles: new Set(tree.list('desk/mar', (p) => p.endsWith('.hoon'))),
    hasApp: (app) => tree.exists(`desk/app/${app}.hoon`),
    agent: agentLoader(tree),
    clientHasApp: (app) => clientDesk?.exists(`desk/app/${app}.hoon`) ?? false,
    clientBilled: (app) => clientBill?.has(app) ?? false,
    clientHasMark: (candidates) =>
      candidates.some((c) => clientMars?.has(c) ?? false),
  };
}

/**
 * Find the `?+` an agent's peek or watch dispatches on.
 *
 * One hop of indirection is followed, because `++ on-peek peek:cor` is the
 * usual spelling and the dispatcher lives in `peek`. That is dispatcher
 * *discovery*, not delegation: once the `?+` is found the walk stops, and an
 * arm that re-dispatches into a sub-handler is simply a match here.
 */
function resolveSurface(
  lines: string[],
  arms: Map<string, HoonArmRange>,
  entry: 'on-peek' | 'on-watch'
): Surface {
  const range = arms.get(entry);
  if (!range) return { dispatcher: null, injection: null, rewritten: false };
  const within = (r: HoonArmRange): Surface => {
    const dispatcher = parseDispatcher(lines, r.start, r.end);
    const injection = versionInjection(lines, r.start, r.end);
    const until = dispatcher ? dispatcher.headerLine - 1 : r.end;
    return {
      dispatcher,
      injection,
      rewritten: dispatcher
        ? rewritesSubject(
            lines,
            r.start,
            until,
            dispatcher.subject,
            injection?.line
          )
        : false,
    };
  };

  const inline = within(range);
  if (inline.dispatcher?.arms.length) return inline;

  const entryText = lines.slice(range.start, range.end).join('\n');
  for (const m of entryText.matchAll(
    /\b([a-z][a-z0-9-]*)(?::[a-z0-9-]+)*\b/g
  )) {
    if (m[1] === entry) continue;
    const target = arms.get(m[1]);
    if (!target) continue;
    const hop = within(target);
    if (hop.dispatcher?.arms.length) return hop;
  }
  return inline;
}

type MatchKind = 'exact' | 'open' | 'prefix' | 'opaque' | 'no';

/**
 * Walk one flattened arm alternative against a request.
 *
 * `prefix` means the arm could still match if the unknown tail supplies the
 * right segments — only possible when there *is* an unknown tail. `opaque`
 * means it matched, but only by consuming a named mold whose members this
 * reader cannot enumerate, so the match is a `WILDCARD`, not a `MATCHED`.
 */
export function matchAlternative(
  alt: Elem[],
  known: string[],
  unknownTail: boolean
): MatchKind {
  let i = 0;
  let j = 0;
  let opaque = false;
  const settle = (kind: MatchKind) =>
    opaque && (kind === 'exact' || kind === 'open') ? 'opaque' : kind;
  while (i < alt.length) {
    const el = alt[i];
    // A `rest` accepts everything from here — but only once every element
    // before it has been matched, which is why this is not a `.some()`.
    if (el.k === 'rest') return settle('open');
    if (j >= known.length) {
      const remaining = alt.slice(i);
      if (remaining.length === 1 && remaining[0].k === 'nil') {
        return unknownTail ? 'no' : settle('exact');
      }
      // The arm still requires segments the request does not supply.
      return unknownTail ? 'prefix' : 'no';
    }
    if (el.k === 'nil') return 'no';
    if (el.k === 'lit' && el.v !== known[j]) return 'no';
    if (el.k === 'opaque') opaque = true;
    i++;
    j++;
  }
  if (j < known.length) return 'no';
  return unknownTail ? 'no' : settle('exact');
}

/** Splice in the version the agent would inject before it dispatches. */
function inject(known: string[], injection: VersionInjection | null): string[] {
  if (!injection || known.length <= injection.index) return known;
  if (injection.members.includes(known[injection.index])) return known;
  const out = [...known];
  out.splice(injection.index, 0, injection.inject);
  return out;
}

export function matchPath(desk: Desk, request: PathRequest): MatchResult {
  const unverified = (
    reason: string,
    rule: Rule = 'coverage'
  ): MatchResult => ({
    verdict: 'UNVERIFIED',
    rule,
    reason,
  });
  const removed = (
    reason: string,
    evidence: string,
    failureMode: FailureMode
  ): MatchResult => ({
    verdict: 'MISSING',
    rule: 'removal',
    reason,
    evidence,
    failureMode,
  });

  if (!desk.hasApp(request.app)) {
    return desk.clientHasApp(request.app)
      ? removed(
          `%${request.app} is no longer an agent in this desk`,
          `desk/app/${request.app}.hoon (removed)`,
          'crash'
        )
      : unverified(`%${request.app} is not an agent in this desk`);
  }
  if (!desk.bill.has(request.app)) {
    return desk.clientBilled(request.app)
      ? removed(
          `%${request.app} is no longer listed in desk/desk.bill, so it does not run`,
          'desk/desk.bill (removed)',
          'not-running'
        )
      : unverified(`%${request.app} is not listed in desk/desk.bill`);
  }

  const agent = desk.agent(request.app);
  if (!agent) return unverified(`desk/app/${request.app}.hoon is unreadable`);
  const surface = request.surface === 'scry' ? agent.peek : agent.watch;
  const entry = request.surface === 'scry' ? 'on-peek' : 'on-watch';
  if (!surface.dispatcher || surface.dispatcher.arms.length === 0) {
    return unverified(
      `no readable ?+ dispatcher under ${entry} in %${request.app}`
    );
  }
  if (surface.rewritten) {
    return {
      ...unverified(
        `%${request.app} rewrites ${surface.dispatcher.subject} before it dispatches, so its arms are not written against the pole as sent`
      ),
      evidence: `${agent.file}:${surface.dispatcher.headerLine}`,
      source: { file: agent.file, line: surface.dispatcher.headerLine },
    };
  }

  const known = inject(request.known, surface.injection);
  const dispatcher = surface.dispatcher;
  const at = (line: number) => ({ file: agent.file, line });
  let best: { arm: Arm; kind: MatchKind } | null = null;
  let prefixed = false;
  for (const arm of dispatcher.arms) {
    for (const alt of arm.alternatives) {
      const kind = matchAlternative(alt, known, request.unknownTail);
      if (kind === 'exact')
        return {
          verdict: 'MATCHED',
          rule: 'prefix',
          reason: `an arm in %${request.app} matches /${known.join('/')} exactly`,
          evidence: `${agent.file}:${arm.line} ${arm.patternText}`,
          source: at(arm.line),
        };
      if ((kind === 'open' || kind === 'opaque') && !best) best = { arm, kind };
      if (kind === 'prefix') prefixed = true;
    }
  }
  if (best) {
    return {
      verdict: 'WILDCARD',
      rule: 'prefix',
      reason:
        best.kind === 'open'
          ? `the only arm that matches consumes the tail with *`
          : `the only arm that matches consumes a segment as the named mold it cannot resolve`,
      evidence: `${agent.file}:${best.arm.line} ${best.arm.patternText}`,
      source: at(best.arm.line),
    };
  }
  if (prefixed) {
    return {
      ...unverified(
        `the interpolated tail decides whether an arm in %${request.app} matches`,
        'suffix'
      ),
      evidence: `${agent.file}:${dispatcher.headerLine} (${dispatcher.arms.length} arms)`,
      source: at(dispatcher.headerLine),
    };
  }
  if (dispatcher.unparsedArms > 0) {
    return {
      ...unverified(
        `${dispatcher.unparsedArms} arm(s) under ${entry} in %${request.app} did not parse`,
        'suffix'
      ),
      evidence: `${agent.file}:${dispatcher.headerLine}`,
      source: at(dispatcher.headerLine),
    };
  }
  return {
    verdict: 'MISSING',
    rule: 'prefix',
    reason: `no ${entry === 'on-peek' ? 'peek' : 'watch'} arm in %${request.app} can match /${known.join('/')}`,
    evidence: `${agent.file}:${dispatcher.headerLine} (${dispatcher.arms.length} arms)`,
    source: at(dispatcher.headerLine),
    failureMode: request.surface === 'scry' ? 'empty' : 'crash',
  };
}

/**
 * Marks vendored from upstream, read off `peru.yaml`'s pick lists.
 *
 * Ownership is decided by **exclusion**: everything under `desk/mar` that is
 * not on a pick list is repo-owned by construction. The obvious alternative —
 * "ours if it resolves at either ref" — is self-defeating for the removal
 * case, because deleting the mar file also erases the proof we owned the mark.
 */
export function vendoredMarks(peruYaml: string): Set<string> {
  return new Set(
    Array.from(
      peruYaml.matchAll(/^\s*-\s+\S*mar\/([A-Za-z0-9_/-]+)\.hoon\s*$/gm)
    ).map((m) => m[1].split('/').join('-'))
  );
}

export function loadOwnership(tree: Tree): Set<string> {
  const peru = tree.readFile('peru.yaml');
  return peru === null ? new Set() : vendoredMarks(peru);
}

/**
 * Every file path Clay would consider for a name. `%a-b-c` may live at any
 * hyphen grouping — `mar/group/action-5.hoon`, `mar/chat/club/action-2.hoon` —
 * so every subset of the hyphens is a candidate directory split.
 */
export function markCandidates(mark: string): string[] {
  const parts = mark.split('-');
  const out: string[] = [];
  for (let mask = 0; mask < 1 << Math.min(parts.length - 1, 12); mask++) {
    const segments = [parts[0]];
    for (let i = 1; i < parts.length; i++) {
      if (mask & (1 << (i - 1))) segments.push(parts[i]);
      else segments[segments.length - 1] += `-${parts[i]}`;
    }
    out.push(`desk/mar/${segments.join('/')}.hoon`);
  }
  return [...new Set(out)];
}

export function matchMark(
  desk: Desk,
  vendored: Set<string>,
  app: string | null,
  mark: string | null
): MatchResult {
  const unverified = (reason: string): MatchResult => ({
    verdict: 'UNVERIFIED',
    rule: 'marks',
    reason,
  });
  if (mark === null)
    return unverified('mark could not be resolved to a string literal');
  // With no target agent there is no verdict to reach in either direction: a
  // mar file is desk-global, so its presence cannot mean the poke lands, and
  // the removal checks below are all keyed on the app.
  if (app === null)
    return unverified('app is not a string literal, so the target is unknown');
  // A deleted or unstarted agent cannot accept any mark, however many mar
  // files survive it. Both beat the file lookup for that reason.
  if (!desk.hasApp(app)) {
    return desk.clientHasApp(app)
      ? {
          verdict: 'MISSING',
          rule: 'removal',
          reason: `%${app} is no longer an agent in this desk, but the client still pokes it`,
          evidence: `desk/app/${app}.hoon (removed)`,
          failureMode: 'crash',
        }
      : unverified(
          `%${mark} targets %${app}, which is not an agent in this desk`
        );
  }
  if (!desk.bill.has(app)) {
    return desk.clientBilled(app)
      ? {
          verdict: 'MISSING',
          rule: 'removal',
          reason: `%${app} is no longer listed in desk/desk.bill, so it does not run`,
          evidence: 'desk/desk.bill (removed)',
          failureMode: 'not-running',
        }
      : unverified(
          `%${mark} targets %${app}, which is not listed in desk/desk.bill`
        );
  }
  const candidates = markCandidates(mark);
  const hit = candidates.find((c) => desk.marFiles.has(c));
  // MATCHED for a mark claims only that the file exists — not that the agent
  // accepts it, and nothing about the JSON shape.
  if (hit) {
    return {
      verdict: 'MATCHED',
      rule: 'marks',
      reason: 'mark file present',
      evidence: hit,
      source: { file: hit, line: 1 },
    };
  }
  if (vendored.has(mark)) {
    return unverified(
      `%${mark} is vendored by peru into desk-deps/, which is not in the repo tree`
    );
  }
  return {
    verdict: 'MISSING',
    rule: desk.clientHasMark(candidates) ? 'removal' : 'marks',
    reason: `no mar file for %${mark} (repo-owned by exclusion from peru.yaml)`,
    evidence: candidates.slice(0, 4).join(', '),
    failureMode: 'crash',
  };
}
