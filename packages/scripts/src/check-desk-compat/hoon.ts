/**
 * A deliberately small Hoon reader: just enough to answer "does this agent
 * serve this pole?".
 *
 * It is a *line* grammar, which the source permits because every `?+` arm
 * pattern in `desk/app` sits on one physical line. That is necessary but not
 * sufficient — arm bodies and nested running runes span lines — so arm
 * boundaries come from the arm indentation plus a `==`-depth counter, and
 * anything that does not parse is recorded rather than guessed at.
 */

/**
 * An atom of a flattened arm pattern. `opaque` is a named mold this reader
 * cannot resolve — `=kind:c` is `?(%diary %heap %chat)`, not "any knot" — so it
 * consumes a segment without establishing that the segment is accepted.
 */
export type Elem =
  | { k: 'lit'; v: string }
  | { k: 'any' }
  | { k: 'opaque'; name: string }
  | { k: 'rest' }
  | { k: 'nil' };

type Node =
  | { t: 'lit'; v: string }
  | { t: 'any' }
  | { t: 'opaque'; name: string }
  | { t: 'rest' }
  | { t: 'nil' }
  | { t: 'union'; members: Node[] }
  | { t: 'tuple'; items: Node[] };

export interface Arm {
  patternText: string;
  /** 1-based line of the arm pattern. */
  line: number;
  /** 1-based line the body's first line occupies, for nested diagnostics. */
  bodyStartLine: number;
  /** Every concrete element list this pattern can take, unions expanded. */
  alternatives: Elem[][];
  bodyText: string;
  /** Faces bound by the pattern, mapped to their token index. */
  faces: Record<string, number>;
  parsed: boolean;
}

export type DefaultKind = 'crash' | 'empty' | 'default-agent' | 'unknown';

export interface Dispatcher {
  subject: string;
  /** 1-based line of the `?+`. */
  headerLine: number;
  defaultKind: DefaultKind;
  arms: Arm[];
  /** Arms whose pattern would not parse; forbids a MISSING verdict. */
  unparsedArms: number;
  /** Name of the `++` arm the dispatcher sits in, when known. */
  armName?: string;
}

// Runes whose tall form is terminated by `==`. Counted so a nested one cannot
// end the dispatcher early or hide an arm.
const OPENER_RE =
  /(?:^|\s)(?:\?\+|\?-|:~|:\*|;:|;~|=~|%\*|\$%|\$\?|\$:)(?=\s|$)/g;
const CLOSER_RE = /(?:^|\s)==(?=\s|$)/g;
const MAX_ALTERNATIVES = 256;

const indentOf = (line: string) => line.length - line.trimStart().length;
const isCode = (line: string) =>
  line.trim().length > 0 && !line.trim().startsWith('::');

function count(line: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(line) !== null) n++;
  return n;
}

/** Whitespace split that keeps bracketed and parenthesised groups whole. */
export function splitTokens(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const c of text) {
    if (c === '[' || c === '(') depth++;
    if (c === ']' || c === ')') depth--;
    if (/\s/.test(c) && depth === 0) {
      if (current) out.push(current);
      current = '';
    } else current += c;
  }
  if (current) out.push(current);
  return out;
}

const stripFace = (token: string) =>
  /^([a-z][a-z0-9-]*)=(.+)$/s.exec(token)?.[2] ?? token;

function parseNode(token: string): Node | null {
  const rest = stripFace(token);
  if (rest === '~') return { t: 'nil' };
  if (rest === '*') return { t: 'rest' };
  if (rest === '^') return { t: 'any' };
  if (/^%[a-z0-9][a-z0-9-]*$/.test(rest)) return { t: 'lit', v: rest.slice(1) };
  // `@`, `@p`, `@ud` accept any knot. A named mold (`=kind:c`, `=cid`, or a
  // locally bound `any`) does not: it is whatever `sur/` says it is.
  if (/^@[a-z]*$/.test(rest)) return { t: 'any' };
  const mold = /^=?([a-z][a-z0-9-]*(?::[a-z0-9-]+)*)$/.exec(rest);
  if (mold) return { t: 'opaque', name: mold[1] };
  const group = (open: string, t: 'union' | 'tuple') => {
    if (!rest.startsWith(open) || !rest.endsWith(open === '?(' ? ')' : ']'))
      return null;
    const inner = splitTokens(rest.slice(open.length, -1)).map(parseNode);
    if (inner.some((n) => n === null)) return null;
    return t === 'union'
      ? ({ t, members: inner as Node[] } as Node)
      : ({ t, items: inner as Node[] } as Node);
  };
  return group('?(', 'union') ?? group('[', 'tuple');
}

function parsePattern(text: string): Node[] | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const items = splitTokens(trimmed.slice(1, -1)).map(parseNode);
    return items.some((i) => i === null) ? null : (items as Node[]);
  }
  const single = parseNode(trimmed);
  return single === null ? null : [single];
}

/**
 * Flatten a pattern into every concrete element list it can match.
 *
 * Nested tuples always flatten: a path pattern is right-nested, so
 * `[%a %b [u=@ ~]]` and `[%a %b u=@ ~]` are the same cell. Unions expand into
 * alternatives, which is what lets `ver=?(%v0 %v1 %v2)` *reject* `%v3` rather
 * than fail open.
 */
function expand(nodes: Node[]): Elem[][] | null {
  let acc: Elem[][] = [[]];
  for (const node of nodes) {
    const options = expandNode(node);
    if (options === null) return null;
    const next: Elem[][] = [];
    for (const prefix of acc) {
      for (const option of options) {
        next.push([...prefix, ...option]);
        if (next.length > MAX_ALTERNATIVES) return null;
      }
    }
    acc = next;
  }
  return acc;
}

function expandNode(node: Node): Elem[][] | null {
  if (node.t === 'tuple') return expand(node.items);
  if (node.t === 'union') {
    const out: Elem[][] = [];
    for (const member of node.members) {
      const expanded = expandNode(member);
      if (expanded === null || out.length > MAX_ALTERNATIVES) return null;
      out.push(...expanded);
    }
    return out;
  }
  if (node.t === 'lit') return [[{ k: 'lit', v: node.v }]];
  if (node.t === 'opaque') return [[{ k: 'opaque', name: node.name }]];
  return [[{ k: node.t }]];
}

/** Parse a pattern and flatten it; exported for the grammar tests. */
export function expandPattern(text: string): Elem[][] | null {
  const nodes = parsePattern(text);
  return nodes === null ? null : expand(nodes);
}

function looksLikePattern(t: string): boolean {
  return (
    t.startsWith('[') ||
    t.startsWith('?(') ||
    (t.startsWith('%') && !/^%[-+*^~]/.test(t)) ||
    /^(~|\*|@[a-z]*)($|\s)/.test(t) ||
    /^[a-z][a-z0-9-]*=/.test(t)
  );
}

/**
 * Tell an arm pattern from a body expression that happens to sit at the same
 * column. Lexical only — no evaluation — but enough for the three shapes that
 * otherwise steal a body line and silently truncate the arm:
 *
 *   groups.hoon:1336   `%group-changed-groups-3`   a `:^` child, not an arm
 *   contacts.hoon:809  `[~ ~]`                     a `?~` branch result
 *   activity.hoon:631  `[id.pole (got:… …)]`       a `=/` initialiser
 *   activity.hoon:452  `[indices activity volume-settings]`  likewise
 */
function couldBeArmPattern(text: string, hasInlineBody: boolean): boolean {
  const bracketed = text.startsWith('[') && text.endsWith(']');
  // A bare `%tag` is only an arm when it carries its body on the same line;
  // standing alone it is a child of the rune above it.
  if (
    !bracketed &&
    text !== '~' &&
    !(hasInlineBody && /^%[a-z0-9]/.test(text))
  ) {
    return false;
  }
  const inner = bracketed ? text.slice(1, -1) : text;
  // A path pattern always pins something: a `%tag`, a `face=`, an `@` aura, a
  // `*` or a `~`. A bracket of bare names is a tuple of values.
  if (!/[%=@*~]/.test(inner)) return false;
  for (const token of bracketed ? splitTokens(inner) : [text]) {
    // A wing dereference (`id.pole`) or a call (`(got:… …)`) is an expression.
    // `?(` is a union, not a call.
    if (token.includes('.') || /(^|[^?])\(/.test(token)) return false;
  }
  return true;
}

/** Runes whose next line is the value they bind, never the next arm. */
const CONTINUES_RE = /^(=\/|=\||=\*|=\+|=\.)(\s|$)/;

/** In a path, `~` only terminates. `[~ ~]` is a result, not a pattern. */
const nilOnlyTerminates = (alts: Elem[][]) =>
  alts.every((alt) =>
    alt.every((e, i) => e.k !== 'nil' || i === alt.length - 1)
  );

function classifyDefault(text: string): DefaultKind {
  // The pinned 408k-rc2 default-agent crashes on an unsupported peek or watch
  // rather than returning [~ ~], so `:def` is a nack, not a silent empty.
  if (/:def\b/.test(text)) return 'default-agent';
  if (text.includes('!!')) return 'crash';
  if (/^(\[\s*~\s+~\s*\]|~)$/.test(text.trim())) return 'empty';
  return 'unknown';
}

const bracketBalance = (token: string) =>
  [...token].reduce((n, c) => n + (c === '[' ? 1 : c === ']' ? -1 : 0), 0);

/**
 * Parse the first `?+` dispatcher in `lines[from..to)`, or null when there is
 * none — a stub arm, or one that delegates somewhere the caller must follow.
 */
export function parseDispatcher(
  lines: string[],
  from: number,
  to: number,
  /** Added to reported line numbers, so a nested parse keeps source offsets. */
  lineOffset = 0
): Dispatcher | null {
  let headerIdx = -1;
  for (let i = from; i < to && headerIdx === -1; i++) {
    if (/^\s*\?\+/.test(lines[i])) headerIdx = i;
  }
  if (headerIdx === -1) return null;
  const header = lines[headerIdx];
  const m = /^(\s*)\?\+\s+(\S+)\s*(.*)$/.exec(header);
  if (!m) return null;
  const subject = m[2];
  let defaultText = m[3].trim();

  let cursor = headerIdx + 1;
  const skipBlank = () => {
    while (cursor < to && !isCode(lines[cursor])) cursor++;
  };
  skipBlank();
  if (defaultText === '') {
    if (cursor >= to) return null;
    defaultText = lines[cursor++].trim();
    skipBlank();
  }
  if (cursor >= to) return null;

  // Hoon lays a wutlus arm out one of two ways: pattern and body share a line,
  // or the pattern sits alone with the body *outdented* under it. Both are
  // indented past the `?+`, but not by a fixed amount — groups.hoon:1295 sits
  // at +5 where its neighbours sit at +4 — so the discriminator is the layout,
  // not the column: an arm either carries its body inline, or is followed by a
  // less-indented line. That is what keeps a bare `[...]` body line from
  // reading as an arm.
  const headerIndent = indentOf(header);
  const nextCodeIndent = (from: number) => {
    for (let i = from; i < to; i++) {
      if (isCode(lines[i])) return indentOf(lines[i]);
    }
    return -1;
  };

  const arms: Arm[] = [];
  let unparsedArms = 0;
  let depth = 0;
  let pending: {
    tokens: string[];
    line: number;
    bodyStart: number;
    body: string[];
  } | null = null;

  const flush = () => {
    if (!pending) return;
    const patternText = pending.tokens.join(' ');
    const alternatives = expandPattern(patternText);
    if (alternatives === null) unparsedArms++;
    const faces: Record<string, number> = {};
    const tokens = patternText.startsWith('[')
      ? splitTokens(patternText.slice(1, -1))
      : [patternText];
    tokens.forEach((token, i) => {
      const face = /^([a-z][a-z0-9-]*)=/.exec(token)?.[1];
      if (face) faces[face] = i;
    });
    arms.push({
      patternText,
      line: pending.line + lineOffset,
      bodyStartLine: pending.bodyStart + lineOffset,
      alternatives: alternatives ?? [],
      bodyText: pending.body.join('\n'),
      faces,
      parsed: alternatives !== null,
    });
    pending = null;
  };

  let previousCode = '';
  for (let i = cursor; i < to; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = indentOf(line);
    if (trimmed === '==' && depth === 0 && indent <= headerIndent) break;
    // A line right under `=/ x` is the value bound to `x`, never the next arm.
    const continuesBinding = CONTINUES_RE.test(previousCode);
    if (isCode(line)) previousCode = trimmed;
    if (
      isCode(line) &&
      depth === 0 &&
      indent > headerIndent &&
      !continuesBinding &&
      looksLikePattern(trimmed)
    ) {
      // The pattern is the leading bracket-balanced token run; the rest of the
      // line is body.
      const tokens = splitTokens(trimmed);
      let take = 1;
      let balance = bracketBalance(tokens[0] ?? '');
      while (balance !== 0 && take < tokens.length)
        balance += bracketBalance(tokens[take++]);
      const body = tokens.slice(take).join(' ');
      const patternText = tokens.slice(0, take).join(' ');
      const laidOutAsArm = body !== '' || nextCodeIndent(i + 1) < indent;
      const expanded =
        balance === 0 &&
        laidOutAsArm &&
        couldBeArmPattern(patternText, body !== '')
          ? expandPattern(patternText)
          : undefined;
      // `expanded === null` is a pattern this reader cannot read, which is
      // still an arm (and suppresses MISSING). A pattern whose `~` does not
      // terminate is a result expression, so it is body.
      if (
        expanded !== undefined &&
        (expanded === null || nilOnlyTerminates(expanded))
      ) {
        flush();
        pending = {
          tokens: tokens.slice(0, take),
          line: i + 1,
          bodyStart: body !== '' ? i + 1 : i + 2,
          body: body ? [body] : [],
        };
        depth += count(line, OPENER_RE) - count(line, CLOSER_RE);
        continue;
      }
    }
    if (pending) pending.body.push(line);
    depth = Math.max(
      0,
      depth + count(line, OPENER_RE) - count(line, CLOSER_RE)
    );
  }
  flush();

  return {
    subject,
    headerLine: headerIdx + 1 + lineOffset,
    defaultKind: classifyDefault(defaultText),
    arms,
    unparsedArms,
  };
}

export interface HoonArmRange {
  name: string;
  /** 0-based, inclusive. */
  start: number;
  /** 0-based, exclusive. */
  end: number;
  indent: number;
}

/** Index every `++ name` arm in a file by name. */
export function indexArms(lines: string[]): Map<string, HoonArmRange> {
  const out = new Map<string, HoonArmRange>();
  const open: HoonArmRange[] = [];
  const close = (upTo: number, indent: number) => {
    while (open.length && open[open.length - 1].indent >= indent) {
      const arm = open.pop()!;
      arm.end = upTo;
      if (!out.has(arm.name)) out.set(arm.name, arm);
    }
  };
  lines.forEach((line, i) => {
    if (!isCode(line)) return;
    const arm = /^(\s*)\+\+\s+([a-z][a-z0-9-]*)\s*(.*)$/.exec(line);
    const end = /^(\s*)(--|\+\$|\+\*)/.exec(line);
    if (arm) {
      close(i, arm[1].length);
      open.push({
        name: arm[2],
        start: i,
        end: lines.length,
        indent: arm[1].length,
      });
    } else if (end) close(i, end[1].length);
  });
  close(lines.length, 0);
  return out;
}

/**
 * Lines between an arm's header and its dispatcher that guard or rewrite the
 * subject. Their presence is P0: the pole the `?+` sees is not the pole the
 * client sent, so no MISSING verdict is available.
 */
export interface Obstruction {
  text: string;
  /**
   * A `guard` can reject the request before the dispatcher sees it, so no
   * MISSING verdict is available. A `rewrite` changes the pole itself, so
   * neither MISSING nor FOUND is — the arms are matching a different path.
   */
  kind: 'guard' | 'rewrite';
  /**
   * The version-injection form, `=? +.pole !?=([?(%v0 %v1) *] +.pole)`, is
   * provably inert when the segment at `index` is already one of `members`.
   */
  inertWhen?: { index: number; members: string[] };
}

/**
 * Guards that are satisfied by construction for a frontend request: the client
 * only ever scries and subscribes to its own ship, so `?> from-self` and its
 * spellings can neither reject it nor hide an absent arm. They are ignored
 * outright; any other guard expression stays conservative.
 */
const SELF_GUARDS = new Set([
  'from-self',
  '=(src.bowl our.bowl)',
  '=(our.bowl src.bowl)',
  '=(our src)',
  '=(src our)',
  '(team:title our.bowl src.bowl)',
]);

export const isSelfGuard = (expr: string) =>
  SELF_GUARDS.has(
    expr
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/:bowl$/, '')
  );

/**
 * A `?>` whose assertion is a self-check, with the value it produces. `?<`
 * asserts the negation, so a self-check there *rejects* the frontend and is
 * deliberately not recognised.
 */
export function stripSelfGuard(line: string): string {
  const tall = /^(\s*)\?>\s+(\S.*)$/.exec(line);
  if (tall) return isSelfGuard(tall[2]) ? tall[1] : line;
  // Wide form can sit anywhere, including inside another rune:
  // contacts.hoon:923 is `~|(local-news+src.bowl ?>(=(our src):bowl cor))`.
  let out = line;
  for (let i = out.indexOf('?>('); i !== -1; i = out.indexOf('?>(', i + 3)) {
    const end = closingParen(out, i + 2);
    if (end === -1) break;
    const [assertion, ...produces] = splitTokens(out.slice(i + 3, end));
    if (!isSelfGuard(assertion ?? '')) continue;
    out = out.slice(0, i) + produces.join(' ') + out.slice(end + 1);
    i = -3;
  }
  return out;
}

function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

export function preDispatchObstructions(
  lines: string[],
  from: number,
  to: number,
  subject = 'pole|path|pat'
): Obstruction[] {
  const subjectRe = new RegExp(`\\b(?:${subject})\\b`);
  const region: string[] = [];
  for (let i = from; i < to; i++) {
    if (isCode(lines[i])) region.push(lines[i].trim());
  }
  const out: Obstruction[] = [];
  for (const raw of region) {
    // A self-guard is satisfied for every frontend request, so it is not an
    // obstruction at all — it blocks neither FOUND nor MISSING.
    const text = stripSelfGuard(raw);
    if (text.trim() === '') continue;
    if (/^(\?>|\?<)[\s(]/.test(text) || /^(\?>|\?<)$/.test(text)) {
      out.push({ text, kind: 'guard' });
      continue;
    }
    // A change rune only matters when it targets the subject: `=^ cards state`
    // in a delegating `on-watch` is an ordinary binding.
    if (!/^(=\?|=\.)(\s|$)/.test(text) || !subjectRe.test(text)) continue;
    out.push({
      text,
      kind: 'rewrite',
      inertWhen: versionInjection(text, region),
    });
  }
  return out;
}

/** Read `=? [+.]<subject> !?=([?(%a %b) *] …)` and the union it tests against. */
function versionInjection(
  text: string,
  region: string[]
): Obstruction['inertWhen'] {
  // The union may contain spaces (`?(%v0 %v1)`), so stop at the ` *]` tail.
  const m = /^=\?\s+(\+\.)?[a-z][a-z0-9-]*\s+!\?=\(\[(.+?)\s+\*\]/.exec(text);
  if (!m) return undefined;
  // `+.pole` skips the head (the care, for a peek); a bare subject does not.
  const index = m[1] ? 1 : 0;
  const union = m[2].startsWith('?(')
    ? m[2]
    : // `=/  any  ?(%v0 %v1)` a line or two up — reel does this.
      region.find((l) => new RegExp(`^=/\\s+${m[2]}\\s+\\?\\(`).test(l));
  if (!union) return undefined;
  const members = Array.from(union.matchAll(/%([a-z0-9][a-z0-9-]*)/g)).map(
    (x) => x[1]
  );
  return members.length > 0 ? { index, members } : undefined;
}
