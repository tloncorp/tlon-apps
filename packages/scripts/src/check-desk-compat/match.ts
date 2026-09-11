import { Tree } from './git';
import {
  Arm,
  Dispatcher,
  Elem,
  HoonArmRange,
  Obstruction,
  indexArms,
  parseDispatcher,
  preDispatchObstructions,
  splitTokens,
  stripSelfGuard,
} from './hoon';

export type Verdict = 'FOUND' | 'MISSING' | 'UNVERIFIED';

/**
 * Which rule decided a verdict. P0-P4 are the ordered classification
 * precedence; the first that fires wins.
 *
 *   P0  pre-dispatch obstruction — the only agent-wide taint
 *   P1  known-prefix absence ⇒ MISSING
 *   P2  prefix matches, suffix unknown ⇒ UNVERIFIED
 *   P3  delegation: a wildcard-tail arm does not terminate the walk
 *   P4  open value sets ⇒ UNVERIFIED
 */
export type Rule =
  | 'P0'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'marks'
  | 'threads'
  | 'negotiation'
  | 'extraction'
  | 'coverage';

/**
 * How the desk fails when a request is not served. Watch dispatchers default
 * to a crash and peek dispatchers to a silent empty, and the user-visible
 * symptom differs, so the verdict carries which.
 */
export type FailureMode = 'crash' | 'empty' | 'unknown';

export interface MatchResult {
  verdict: Verdict;
  rule: Rule;
  reason: string;
  /** Desk-side evidence: the arm or file the verdict turned on. */
  evidence?: string;
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

interface AgentSurface {
  kind: 'inline' | 'delegated' | 'default-agent' | 'stub' | 'absent';
  dispatcher: Dispatcher | null;
  obstructions: Obstruction[];
}

interface Agent {
  name: string;
  file: string;
  lines: string[];
  arms: Map<string, HoonArmRange>;
  peek: AgentSurface;
  watch: AgentSurface;
}

export interface Desk {
  ref: string;
  tree: Tree;
  bill: Set<string>;
  marFiles: Set<string>;
  hasApp(app: string): boolean;
  agent(app: string): Agent | null;
}

export function loadDesk(tree: Tree, ref: string): Desk {
  const bill = new Set(
    Array.from(
      (tree.readFile('desk/desk.bill') ?? '').matchAll(/%([a-z][a-z0-9-]*)/g)
    ).map((m) => m[1])
  );
  // Agents are parsed lazily; a run touches a handful of the 27.
  const cache = new Map<string, Agent | null>();
  return {
    ref,
    tree,
    bill,
    marFiles: new Set(tree.list('desk/mar', (p) => p.endsWith('.hoon'))),
    hasApp: (app) => tree.exists(`desk/app/${app}.hoon`),
    agent(app) {
      if (!cache.has(app)) {
        const file = `desk/app/${app}.hoon`;
        const source = tree.readFile(file);
        const lines = source?.split('\n');
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
    },
  };
}

/**
 * Find the `?+` an agent's peek or watch actually dispatches on, following one
 * level of delegation (`++ on-peek peek:cor`, `(peek:cor path)`), and collect
 * anything that guards or rewrites the subject before that `?+` runs.
 */
function resolveSurface(
  lines: string[],
  arms: Map<string, HoonArmRange>,
  entry: 'on-peek' | 'on-watch'
): AgentSurface {
  const range = arms.get(entry);
  if (!range) return { kind: 'absent', dispatcher: null, obstructions: [] };

  const inline = parseDispatcher(lines, range.start, range.end);
  if (inline?.arms.length) {
    return {
      kind: 'inline',
      dispatcher: { ...inline, armName: entry },
      obstructions: preDispatchObstructions(
        lines,
        range.start + 1,
        inline.headerLine - 1,
        inline.subject
      ),
    };
  }

  const entryText = lines.slice(range.start, range.end).join('\n');
  const obstructions = preDispatchObstructions(
    lines,
    range.start + 1,
    range.end
  );
  for (const m of entryText.matchAll(
    /\b([a-z][a-z0-9-]*)(?::[a-z][a-z0-9-]*)*\b/g
  )) {
    const target = m[1] === entry ? undefined : arms.get(m[1]);
    if (!target) continue;
    const dispatcher = parseDispatcher(lines, target.start, target.end);
    if (dispatcher?.arms.length) {
      return {
        kind: 'delegated',
        dispatcher: { ...dispatcher, armName: m[1] },
        obstructions: [
          ...obstructions,
          ...preDispatchObstructions(
            lines,
            target.start + 1,
            dispatcher.headerLine - 1,
            dispatcher.subject
          ),
        ],
      };
    }
  }
  return {
    kind: new RegExp(`${entry}:def`).test(entryText) ? 'default-agent' : 'stub',
    dispatcher: null,
    obstructions,
  };
}

type MatchKind = 'exact' | 'open' | 'prefix' | 'opaque' | 'no';

/**
 * Walk one flattened arm alternative against a request.
 *
 * `prefix` means the arm could still match if the unknown tail supplies the
 * right segments — only possible when there *is* an unknown tail. `opaque`
 * means it matched, but only by consuming a named mold whose members this
 * reader cannot enumerate, so service is not established.
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

interface ArmMatch {
  arm: Arm;
  alternative: Elem[];
  kind: 'exact' | 'open';
}

function failureModeOf(dispatcher: Dispatcher | null): FailureMode {
  switch (dispatcher?.defaultKind) {
    case 'crash':
    case 'default-agent':
      return 'crash';
    case 'empty':
      return 'empty';
    default:
      return 'unknown';
  }
}

export function matchPath(
  desk: Desk,
  request: PathRequest,
  depth = 0
): MatchResult {
  const unverified = (reason: string, evidence?: string): MatchResult => ({
    verdict: 'UNVERIFIED',
    rule: 'coverage',
    reason,
    evidence,
  });
  if (!desk.hasApp(request.app)) {
    return unverified(
      `%${request.app} is not an agent in this desk (out-of-desk app)`
    );
  }
  if (!desk.bill.has(request.app)) {
    return unverified(
      `%${request.app} is not listed in desk/desk.bill, so it may not be running`
    );
  }
  const agent = desk.agent(request.app);
  if (!agent) return unverified(`could not read desk/app/${request.app}.hoon`);

  const entry = request.surface === 'scry' ? 'on-peek' : 'on-watch';
  const surface = request.surface === 'scry' ? agent.peek : agent.watch;
  if (surface.kind === 'default-agent') {
    return unverified(
      `%${request.app} routes ${entry} to default-agent`,
      agent.file
    );
  }
  if (surface.kind === 'stub' || surface.kind === 'absent') {
    return unverified(
      `%${request.app} has no parseable ${entry} dispatcher (${surface.kind})`,
      agent.file
    );
  }

  const dispatcher = surface.dispatcher!;
  const p0 = (why: string, obstructions: Obstruction[]): MatchResult => ({
    verdict: 'UNVERIFIED',
    rule: 'P0',
    reason: `%${request.app} ${why} before dispatch`,
    evidence: obstructions.map((o) => o.text).join(' ; '),
    failureMode: failureModeOf(dispatcher),
  });

  // P0 runs before the walk, not after it. A rewrite changes the pole the arms
  // see, so it invalidates FOUND as much as MISSING: an arm added for `%v7`
  // without extending the injection list matches here while the live pole
  // becomes `/v0/v7/…`. Only a rewrite this reader can prove inert for *this*
  // request — the segment is already a version the injection tests for — is
  // safe to ignore.
  const rewrites = surface.obstructions.filter(
    (o) => o.kind === 'rewrite' && !isInert(o, request)
  );
  if (rewrites.length > 0) return p0('rewrites the pole', rewrites);

  const walked = walk(desk, agent, dispatcher, request, new Set(), depth);
  if (walked.verdict !== 'MISSING') return walked;
  // A guard can reject before the dispatcher is reached, and an arm this
  // reader could not parse might have served; neither allows MISSING.
  if (surface.obstructions.length > 0) {
    return p0('guards the pole', surface.obstructions);
  }
  if (dispatcher.unparsedArms > 0) {
    return {
      verdict: 'UNVERIFIED',
      rule: 'extraction',
      reason: `%${request.app}'s ${entry} has ${dispatcher.unparsedArms} arm(s) this reader could not parse`,
      evidence: `${agent.file}:${dispatcher.headerLine}`,
      failureMode: failureModeOf(dispatcher),
    };
  }
  return walked;
}

// Wide form puts the rune straight against its `(` — `?:(cached …)`,
// `?>(from-self cor)` — so a whitespace-only boundary misses half of them.
const BRANCH_RE =
  /(^|\s)(\?~|\?:|\?-|\?\.|\?\^|\?<|\?>|\?&|\?\||\?\+|=\?)([\s(]|$)/;
const DECODE_RE = /\bsla[vw]\b[^\n]*\.(pole|path|pat)\b|\(need\s|%-\s+need\b/;

/**
 * Whether an arm body decides anything about the path after the pattern
 * matched. `contacts.hoon:808` matches `[%x %v1 %book her=@p ~]` and then
 * rejects with `?~ who=(slaw %p her.pat)`; the same decision can be spelled
 * `?:` instead of a nested `?+`. Neither service nor absence is established
 * through such a body, so the answer is UNVERIFIED.
 *
 * Lexical, and deliberately so: evaluating the branch is the machinery this
 * reader does not have.
 */
function bodyBranches(body: string): string | null {
  for (const raw of body.split('\n')) {
    // `?>(from-self cor)` cannot reject a frontend request, so it is dropped
    // before the line is judged; what it produces is still examined.
    const line = stripSelfGuard(raw);
    const branch = BRANCH_RE.exec(line);
    if (branch) return branch[2];
    if (DECODE_RE.test(line)) return 'a decode that can fail (slaw/slav/need)';
  }
  return null;
}

/** A version-injection rewrite provably does not fire for this request. */
function isInert(o: Obstruction, request: PathRequest): boolean {
  const segment = o.inertWhen && request.known[o.inertWhen.index];
  return segment !== undefined && o.inertWhen!.members.includes(segment);
}

const MAX_DELEGATION_DEPTH = 4;

function walk(
  desk: Desk,
  agent: Agent,
  dispatcher: Dispatcher,
  request: PathRequest,
  visited: Set<string>,
  depth: number
): MatchResult {
  const where = `${agent.file}:${dispatcher.headerLine}`;
  const key = `${agent.name}|${dispatcher.headerLine}|${request.known.join('/')}|${request.unknownTail}`;
  if (visited.has(key) || depth > MAX_DELEGATION_DEPTH) {
    return {
      verdict: 'UNVERIFIED',
      rule: 'P3',
      reason: 'delegation walk did not terminate within its bound',
      evidence: where,
    };
  }
  visited.add(key);

  const served: ArmMatch[] = [];
  const prefixed: Arm[] = [];
  const opaque: { arm: Arm; mold: string }[] = [];
  for (const arm of dispatcher.arms) {
    if (!arm.parsed) continue;
    for (const alternative of arm.alternatives) {
      const kind = matchAlternative(
        alternative,
        request.known,
        request.unknownTail
      );
      if (kind === 'exact' || kind === 'open')
        served.push({ arm, alternative, kind });
      else if (kind === 'prefix') prefixed.push(arm);
      else if (kind === 'opaque') {
        const el = alternative.find((e) => e.k === 'opaque');
        opaque.push({ arm, mold: el?.k === 'opaque' ? el.name : '?' });
      }
    }
  }

  if (served.length === 0) {
    // The arm matched only by consuming a named mold — `=kind:c` is
    // `?(%diary %heap %chat)`, not "any knot" — so neither service nor absence
    // is established without resolving the type.
    if (opaque.length > 0) {
      return {
        verdict: 'UNVERIFIED',
        rule: 'extraction',
        reason: `matching /${request.known.join('/')} turns on the mold +$${opaque[0].mold}, which this reader does not resolve`,
        evidence: `${agent.file}:${opaque[0].arm.line} ${opaque[0].arm.patternText}`,
        failureMode: failureModeOf(dispatcher),
      };
    }
    // P2 — the prefix matches but the matched arms do not accept every
    // completion at that position.
    if (prefixed.length > 0) {
      return {
        verdict: 'UNVERIFIED',
        rule: 'P2',
        reason: `prefix /${request.known.join('/')} reaches ${prefixed.length} arm(s) but the interpolated tail is unbounded`,
        evidence: prefixed
          .slice(0, 3)
          .map((a) => `${agent.file}:${a.line} ${a.patternText}`)
          .join(' | '),
        failureMode: failureModeOf(dispatcher),
      };
    }
    // P1 — no arm can match the known prefix under any completion.
    return {
      verdict: 'MISSING',
      rule: 'P1',
      reason: `no ${dispatcher.armName ?? 'dispatch'} arm in %${agent.name} can match /${request.known.join('/')}`,
      evidence: `${where} (${dispatcher.arms.length} arms, default ${dispatcher.defaultKind})`,
      failureMode: failureModeOf(dispatcher),
    };
  }

  // P3 — only an arm that *serves* terminates the walk.
  const results = served.map((m) =>
    resolveArm(desk, agent, dispatcher, request, m, visited, depth)
  );
  return (
    results.find((r) => r.verdict === 'MISSING') ??
    results.find((r) => r.verdict === 'UNVERIFIED') ??
    results[0]
  );
}

function resolveArm(
  desk: Desk,
  agent: Agent,
  dispatcher: Dispatcher,
  request: PathRequest,
  match: ArmMatch,
  visited: Set<string>,
  depth: number
): MatchResult {
  const where = `${agent.file}:${match.arm.line} ${match.arm.patternText}`;
  const unverified = (reason: string): MatchResult => ({
    verdict: 'UNVERIFIED',
    rule: 'P3',
    reason,
    evidence: where,
  });
  const delegation = findDelegation(agent, dispatcher, match.arm);

  if (delegation) {
    // An arm that serves some completions and re-dispatches others turns on a
    // condition this reader cannot evaluate, and matching a wildcard tail is
    // not service — so neither FOUND nor MISSING is available.
    if (!delegation.whole) {
      return unverified(
        `arm serves some requests directly and re-dispatches others into ${delegation.target}`
      );
    }
    const rebuilt =
      delegation.expr && rebuildPath(match, request, delegation.expr);
    if (!rebuilt) {
      return unverified(
        `arm delegates to ${delegation.target} with a path this reader could not rebuild (${delegation.expr ?? 'multi-argument call'})`
      );
    }
    const targetRange = agent.arms.get(delegation.target);
    const sub =
      delegation.kind === 'self'
        ? dispatcher
        : targetRange &&
          parseDispatcher(agent.lines, targetRange.start, targetRange.end);
    if (!sub?.arms.length) {
      return unverified(
        `arm delegates to ${delegation.target}, whose dispatcher could not be resolved`
      );
    }
    const inner = walk(
      desk,
      agent,
      { ...sub, armName: delegation.target },
      { ...request, ...rebuilt },
      visited,
      depth + 1
    );
    return {
      ...inner,
      reason: `${inner.reason} (via ${delegation.target}, delegated path /${rebuilt.known.join('/')})`,
      evidence: inner.evidence ?? where,
    };
  }

  // A nested `?+` inside the arm decides the rest of the path, so the outer
  // arm has not served anything yet — `[%x ver %changes since=@ rest=*]`
  // accepts only an empty `rest` or `/count`.
  const bodyLines = match.arm.bodyText.split('\n');
  const nested = parseDispatcher(
    bodyLines,
    0,
    bodyLines.length,
    match.arm.bodyStartLine - 1
  );
  if (nested?.arms.length) {
    // Only an unconditional path from the arm to the `?+` makes the nested
    // dispatcher the decision: a `?~` above it may already have returned.
    const before = bodyLines
      .slice(0, nested.headerLine - match.arm.bodyStartLine)
      .join('\n');
    const branch = bodyBranches(before);
    if (branch) {
      return unverified(
        `arm branches on \`${branch}\` before re-dispatching, so the nested \`?+\` is not the whole decision`
      );
    }
    const expr = singleExpression(nested.subject);
    const rebuilt = expr && rebuildPath(match, request, expr);
    if (!rebuilt) {
      return unverified(
        `arm re-dispatches on ${nested.subject}, which this reader could not rebuild`
      );
    }
    const inner = walk(
      desk,
      agent,
      { ...nested, armName: `nested ?+ ${nested.subject}` },
      { ...request, ...rebuilt },
      visited,
      depth + 1
    );
    return {
      ...inner,
      reason: `${inner.reason} (nested dispatch on ${nested.subject}, /${rebuilt.known.join('/')})`,
      evidence: inner.evidence ?? where,
    };
  }

  // Follow `.^` fan-out one level, literal poles only. The literal calls are
  // evaluated before the unresolved ones are reported, so one unreadable scry
  // cannot mask a missing dependency beside it.
  const fanout = scryFanout(match.arm.bodyText);
  if (depth > 0 && (fanout.calls.length > 0 || fanout.unresolved)) {
    return unverified('nested scry fan-out beyond one level is not followed');
  }
  // A `.^` the arm reaches unconditionally is a dependency; one under a `?:`
  // may never run, so it can only soften the verdict, never produce MISSING.
  const conditional = bodyBranches(match.arm.bodyText);
  const onward = fanout.calls.map(
    (inner) => [inner, matchPath(desk, inner, depth + 1)] as const
  );
  const worst =
    (conditional ? null : onward.find(([, r]) => r.verdict === 'MISSING')) ??
    (fanout.unresolved ? null : onward.find(([, r]) => r.verdict !== 'FOUND'));
  if (worst) {
    const [inner, result] = worst;
    const verdict = conditional ? 'UNVERIFIED' : result.verdict;
    return {
      verdict,
      rule: 'P3',
      reason:
        `arm scries %${inner.app} /${inner.known.slice(1).join('/')}, which is ${result.verdict.toLowerCase()}` +
        (conditional
          ? `, under a \`${conditional}\` branch`
          : `: ${result.reason}`),
      evidence: result.evidence ?? where,
      failureMode: verdict === 'MISSING' ? result.failureMode : undefined,
    };
  }
  if (fanout.unresolved) {
    return unverified(
      `arm scries onward through an expression this reader could not resolve (${fanout.unresolved})`
    );
  }
  // An arm body that calls a same-file helper which itself scries is beyond
  // one level, so it propagates as UNVERIFIED rather than FOUND.
  const helper = scryingHelper(agent, match.arm);
  if (helper) {
    return unverified(
      `arm body calls +${helper}, which scries onward (beyond the one-level limit)`
    );
  }
  // The pattern matched, but the body still decides — a `?~` on a decoded
  // segment rejects paths the pattern accepts.
  if (conditional) {
    return unverified(
      `arm body branches on \`${conditional}\`, so matching the pattern does not establish service`
    );
  }
  return {
    verdict: 'FOUND',
    rule: match.kind === 'open' ? 'P3' : 'P1',
    reason: `served by ${match.arm.patternText}`,
    evidence: where,
  };
}

interface Delegation {
  kind: 'self' | 'arm';
  target: string;
  /** null when the delegated path is not a single rebuildable expression. */
  expr: string | null;
  /** Whole body is the delegating call, so the arm never serves directly. */
  whole: boolean;
}

/**
 * A matched arm whose body re-dispatches rather than serving: a `$(pole …)`
 * rewrite back into the same wutlus, or a call into a sub-core arm with a
 * reconstructed path such as `(le-peek:le-core [%v1 t.t.t.path])`.
 *
 * The path is rebuilt only when the delegated argument is a *single*
 * expression. A multi-argument call like `(go-peek:… ver.pole rest.pole)`
 * cannot be told apart from a path spelled as loose tokens without the
 * callee's signature, so it stays unresolved rather than being guessed at.
 */
function findDelegation(
  agent: Agent,
  dispatcher: Dispatcher,
  arm: Arm
): Delegation | null {
  const body = arm.bodyText;
  const normalized = body.trim().replace(/\s+/g, ' ');
  const self = findCall(body, `$(${dispatcher.subject}`);
  if (self) {
    return {
      kind: 'self',
      target: dispatcher.armName ?? 'self',
      expr: singleExpression(self.expr),
      whole: normalized === self.full.trim().replace(/\s+/g, ' '),
    };
  }
  for (const call of balancedCalls(body)) {
    const tokens = splitTokens(call);
    const head = tokens[0]?.split(':')[0];
    if (tokens.length < 2 || !head || head === agent.name) continue;
    const target = agent.arms.get(head);
    if (!target || (target.start >= arm.line - 1 && target.end <= arm.line))
      continue;
    if (!parseDispatcher(agent.lines, target.start, target.end)?.arms.length)
      continue;
    const rest = tokens.slice(1);
    return {
      kind: 'arm',
      target: head,
      expr: rest.length === 1 ? singleExpression(rest[0]) : null,
      whole: normalized === `(${call.trim().replace(/\s+/g, ' ')})`,
    };
  }
  return null;
}

/** Accept only the delegated-path forms this reader can rebuild faithfully. */
function singleExpression(text: string): string | null {
  const trimmed = text.trim().replace(/\n\s*/g, ' ');
  return /^\[.*\](:[a-z][a-z0-9-]*)?$/.test(trimmed) ||
    /^\/\S*$/.test(trimmed) ||
    /^(?:t\.)*(pole|path|pat)$/.test(trimmed) ||
    /^[a-z][a-z0-9-]*\.(pole|path|pat)$/.test(trimmed)
    ? trimmed
    : null;
}

function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function findCall(
  text: string,
  opener: string
): { expr: string; full: string } | null {
  const idx = text.indexOf(opener);
  if (idx === -1) return null;
  const open = text.indexOf('(', idx);
  const end = matchParen(text, open);
  if (end === -1) return null;
  const inner = text.slice(open + 1, end);
  // Drop the subject name that follows `$(`.
  return {
    expr: inner.slice(inner.indexOf(' ') + 1).trim(),
    full: text.slice(idx, end + 1),
  };
}

function balancedCalls(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(') continue;
    const end = matchParen(text, i);
    if (end !== -1) out.push(text.slice(i + 1, end));
  }
  return out;
}

/**
 * Rebuild the path an arm hands to a sub-dispatcher. Handles the forms that
 * appear in `desk/app`: a literal path, literal knots, `t.t.…path` slices, and
 * a face bound by the matched arm.
 */
export function rebuildPath(
  match: ArmMatch,
  request: PathRequest,
  expr: string
): { known: string[]; unknownTail: boolean } | null {
  let trimmed = expr.trim();
  if (trimmed.startsWith('/')) {
    return { known: trimmed.split('/').filter(Boolean), unknownTail: false };
  }
  // `[…]:pole` binds the faces inside the tuple against the matched pole.
  trimmed = trimmed.replace(/^(\[.*\]):[a-z][a-z0-9-]*$/, '$1');
  const tokens = trimmed.startsWith('[')
    ? splitTokens(trimmed.slice(1, -1))
    : splitTokens(trimmed);
  // Face indices line up with element indices only when every pattern token
  // expanded to exactly one element.
  const patternTokens = match.arm.patternText.startsWith('[')
    ? splitTokens(match.arm.patternText.slice(1, -1))
    : [match.arm.patternText];
  const facesUsable = patternTokens.length === match.alternative.length;

  const known: string[] = [];
  let unknownTail = false;
  const takeFrom = (drop: number) => {
    if (drop > request.known.length && request.unknownTail) return false;
    known.push(...request.known.slice(drop));
    unknownTail = request.unknownTail;
    return true;
  };
  for (const token of tokens) {
    if (unknownTail) return null;
    // A `~` terminator in the rebuilt tuple pins the length exactly.
    if (token === '~') continue;
    const lit = /^%([a-z0-9][a-z0-9-]*)$/.exec(token);
    if (lit) {
      known.push(lit[1]);
      continue;
    }
    const slice = /^((?:t\.)*)(pole|path|pat)$/.exec(token);
    if (slice) {
      if (!takeFrom((slice[1].match(/t\./g) ?? []).length)) return null;
      continue;
    }
    const face = /^([a-z][a-z0-9-]*)(?:\.(?:pole|path|pat))?$/.exec(token)?.[1];
    const idx = face && facesUsable ? match.arm.faces[face] : undefined;
    if (idx === undefined) return null;
    if (match.alternative[idx]?.k === 'rest') {
      if (!takeFrom(idx)) return null;
    } else if (idx < request.known.length) known.push(request.known[idx]);
    else return null;
  }
  return { known, unknownTail };
}

/** Literal `.^(… (scry %gx %app /a/b/mark))` calls in an arm body. */
export function scryFanout(body: string): {
  calls: PathRequest[];
  unresolved: string | null;
} {
  const calls: PathRequest[] = [];
  let unresolved: string | null = null;
  for (
    let idx = body.indexOf('.^');
    idx !== -1;
    idx = body.indexOf('.^', idx + 2)
  ) {
    const open = body.indexOf('(', idx);
    const end = open === -1 ? -1 : matchParen(body, open);
    const chunk =
      end === -1 ? body.slice(idx, idx + 120) : body.slice(idx, end + 1);
    const scryIdx = chunk.indexOf('(scry ');
    if (scryIdx === -1) {
      unresolved = chunk.trim().split('\n')[0];
      continue;
    }
    const inner = chunk.slice(scryIdx + 1, matchParen(chunk, scryIdx));
    const tokens = splitTokens(inner);
    const care = /^%g([a-z])$/.exec(tokens[1] ?? '')?.[1];
    const app = /^%([a-z][a-z0-9-]*)$/.exec(tokens[2] ?? '')?.[1];
    const path = tokens[3] ?? '';
    if (!care || !app || !path.startsWith('/') || /[()[\]]/.test(path)) {
      unresolved = inner.trim().split('\n')[0];
      continue;
    }
    const segments = path.split('/').filter(Boolean);
    // The last segment of a `.^` path is the result mark, not part of the pole.
    segments.pop();
    calls.push({
      app,
      surface: 'scry',
      known: [care, ...segments],
      unknownTail: false,
    });
  }
  return { calls, unresolved };
}

function scryingHelper(agent: Agent, arm: Arm): string | null {
  for (const call of balancedCalls(arm.bodyText)) {
    const head = splitTokens(call)[0]?.split(':')[0];
    const range = head && agent.arms.get(head);
    if (
      range &&
      agent.lines.slice(range.start, range.end).join('\n').includes('.^')
    ) {
      return head!;
    }
  }
  return null;
}
