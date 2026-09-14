/**
 * A deliberately small Hoon reader: just enough to say whether an agent has an
 * arm whose pattern can match a pole.
 *
 * It is a *line* grammar, which the source permits because every `?+` arm
 * pattern in `desk/app` sits on one physical line. Arm bodies are not read at
 * all: this reader answers "is there an arm for this shape", never "does that
 * arm serve the request". Everything it cannot read it says so about, because
 * the only verdict that fails a run is `MISSING`, and a misread must never
 * produce one.
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
  /** Every concrete element list this pattern can take, unions expanded. */
  alternatives: Elem[][];
  parsed: boolean;
}

export interface Dispatcher {
  subject: string;
  /** 1-based line of the `?+`. */
  headerLine: number;
  arms: Arm[];
  /** Arms whose pattern would not parse; forbids a MISSING verdict. */
  unparsedArms: number;
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

/**
 * Blank out a `::` comment, keeping the line (and so every line number) in
 * place. A `::` inside a cord or tape is text, not a comment, so the scan
 * tracks quoting.
 *
 * This runs before anything structural. A rune written in a trailing comment
 * would otherwise move the depth counter and swallow the arms below it,
 * turning a served request into a blocking `MISSING`.
 */
export function stripComment(line: string): string {
  const end = scanQuoted(line, (i) =>
    line[i] === ':' && line[i + 1] === ':' ? i : null
  );
  return end === null ? line : line.slice(0, end).trimEnd();
}

export const stripComments = (lines: string[]): string[] =>
  lines.map(stripComment);

/**
 * Walk a line outside cords and tapes, handing each index to `at` and
 * returning the first non-null answer. `'::'` inside `'…'` or `"…"` is text,
 * and so is a rune: a body holding `"a ?+ b"` would otherwise open a depth the
 * dispatcher never closes and swallow every arm below it.
 */
function scanQuoted<T>(line: string, at: (i: number) => T | null): T | null {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote !== null) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    const answer = at(i);
    if (answer !== null) return answer;
  }
  return null;
}

/** The line with every cord and tape blanked out, for structural counting. */
export function blankQuoted(line: string): string {
  const out = [...line];
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote !== null) {
      out[i] = ' ';
      if (c === '\\') {
        if (i + 1 < line.length) out[++i] = ' ';
      } else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      out[i] = ' ';
    }
  }
  return out.join('');
}

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
  // `@`, `@p`, `@ud` accept any knot. A named mold (`=kind:c`, `=cid`) does
  // not: it is whatever `sur/` says it is, so it is opaque.
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

/**
 * Does this line look like an arm pattern rather than a body expression that
 * happens to start with `[`?
 *
 * A path pattern always pins something: a `%tag`, a `face=`, an `@` aura, a
 * `*` or a `~`. A bracket of bare names is a tuple of values, and a wing
 * dereference (`id.pole`) or a call (`(got:… …)`) is an expression — those
 * would otherwise parse as unreadable arms and suppress `MISSING` for the
 * whole surface.
 */
/**
 * Could this line be an arm pattern at all, whether or not it reads as one?
 *
 * The difference matters: a line that could be a pattern and will not parse is
 * an arm this reader failed, which has to withhold `MISSING` for the surface.
 * A line that could never have been one is a body expression, and counting it
 * would withhold `MISSING` for every agent with a multi-line arm body.
 *
 * Three tests separate them. It must *start* like a pattern — a bracket, a
 * union, a `%term` (not a `%-` rune), a `face=`, an aura, a `~` or a `*`. Its
 * inner text must *pin* something: a bracket of bare names like
 * `[indices activity volume-settings]` is a tuple of values. And no token may
 * hold a call: `[id.pole (got:on-event:a …)]` pins a `%da` and still is not a
 * pattern.
 */
export function plausiblePattern(text: string): boolean {
  if (text === '~' || text === '*') return true;
  const starts =
    text.startsWith('[') ||
    text.startsWith('?(') ||
    /^%[a-z0-9]/.test(text) ||
    /^[a-z][a-z0-9-]*=/.test(text) ||
    /^@[a-z]*$/.test(text);
  if (!starts) return false;
  const inner = text.replace(/^\[/, '').replace(/\]$/, '');
  if (!/[%=@*~]/.test(inner)) return false;
  return splitTokens(inner).every((t) => !/(^|[^?])\(/.test(t));
}

export function looksLikeArmPattern(text: string): boolean {
  // A bare `~` or `*` is a whole arm pattern on its own. Both also occur as
  // body expressions, and both are read as arms deliberately: `~` matches only
  // the empty pole and `*` catches everything, so mistaking a body line for
  // one can turn a MISSING into a match but never the other way.
  if (text === '~' || text === '*') return true;
  const bracketed = text.startsWith('[') && text.endsWith(']');
  if (!bracketed && !text.startsWith('?(') && !/^%[a-z0-9]/.test(text))
    return false;
  if (!plausiblePattern(text)) return false;
  // A wing (`kind=foo.bar`) is a mold this reader has no rule for. It is a
  // pattern, so it is an unparsed arm rather than a body line.
  const inner = bracketed ? text.slice(1, -1) : text;
  return splitTokens(inner).every((token) => !token.includes('.'));
}

const bracketBalance = (token: string) =>
  [...token].reduce((n, c) => n + (c === '[' ? 1 : c === ']' ? -1 : 0), 0);

/**
 * Parse the first `?+` dispatcher in `lines[from..to)`, or null when there is
 * none — which the caller reports as `UNVERIFIED` for the whole surface,
 * never as an absence.
 *
 * An arm is a code line indented past the `?+`, at `==`-depth zero, whose
 * leading bracket-balanced token run reads as a pattern. Reading a body line
 * as an extra arm is safe in the one direction that matters: an extra arm can
 * only turn a `MISSING` into a match, never the reverse.
 *
 * A line that *wants* to be a pattern and will not read as one — brackets that
 * carry on to the next line, a mold wing with a `.` in it, a shape this reader
 * has no rule for — is counted as an unparsed arm, which withholds `MISSING`
 * for the whole surface. Silently dropping it is the one thing that cannot be
 * allowed: the arm is there, and the request it takes would read as absent.
 */
export function parseDispatcher(
  lines: string[],
  from: number,
  to: number
): Dispatcher | null {
  let headerIdx = -1;
  for (let i = from; i < to && headerIdx === -1; i++) {
    if (/^\s*\?\+/.test(lines[i])) headerIdx = i;
  }
  if (headerIdx === -1) return null;
  const header = lines[headerIdx];
  const m = /^(\s*)\?\+\s+(\S+)\s*(.*)$/.exec(header);
  if (!m) return null;
  const headerIndent = indentOf(header);

  let cursor = headerIdx + 1;
  const skipBlank = () => {
    while (cursor < to && !isCode(lines[cursor])) cursor++;
  };
  skipBlank();
  // The default may sit on the header line or on the line under it.
  if (m[3].trim() === '') {
    cursor++;
    skipBlank();
  }

  const arms: Arm[] = [];
  let unparsedArms = 0;
  let depth = 0;
  for (let i = cursor; i < to; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '==' && depth === 0 && indentOf(line) <= headerIndent)
      break;
    if (isCode(line) && depth === 0 && indentOf(line) > headerIndent) {
      // The pattern is the leading bracket-balanced token run; the rest of the
      // line is body, which this reader does not look at.
      const tokens = splitTokens(trimmed);
      let take = 1;
      let balance = bracketBalance(tokens[0] ?? '');
      while (balance !== 0 && take < tokens.length)
        balance += bracketBalance(tokens[take++]);
      const patternText = tokens.slice(0, take).join(' ');
      const readable = balance === 0 && looksLikeArmPattern(patternText);
      const alternatives = readable ? expandPattern(patternText) : null;
      // Classify the *pattern*, never the whole line: the body beside it
      // holds calls and wings, and judging on those discards
      // `[%x %v1 kind=foo.bar ~]  (serve path)` as if it were a body line.
      // An unbalanced `[` is a pattern carrying on to the next line, which is
      // an arm this reader cannot read rather than a line to drop.
      if (alternatives !== null) {
        arms.push({ patternText, line: i + 1, alternatives, parsed: true });
      } else if (balance > 0 || plausiblePattern(patternText)) {
        unparsedArms++;
        arms.push({
          patternText,
          line: i + 1,
          alternatives: [],
          parsed: false,
        });
      }
    }
    const code = blankQuoted(line);
    depth = Math.max(
      0,
      depth + count(code, OPENER_RE) - count(code, CLOSER_RE)
    );
  }

  return { subject: m[2], headerLine: headerIdx + 1, arms, unparsedArms };
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
 * `channels.hoon` rewrites the pole before its `?+`:
 *
 *     =?  +.pole  !?=([?(%v0 %v1 … %v6) *] +.pole)
 *       [%v0 +.pole]
 *
 * An unversioned request is therefore dispatched as a `%v0` one, and matching
 * the pole as sent would report a `MISSING` the agent does not have.
 */
export interface VersionInjection {
  /** Pole index the version occupies: 1 under `+.pole`, 0 under a bare one. */
  index: number;
  /** Versions passed through untouched. */
  members: string[];
  /** The version spliced in when the pole carries none. */
  inject: string;
  /** 0-based line the `=?` sits on, so it is not read as a rewrite. */
  line: number;
}

export function versionInjection(
  lines: string[],
  from: number,
  to: number
): VersionInjection | null {
  for (let i = from; i < to; i++) {
    // The union may contain spaces (`?(%v0 %v1)`), so stop at the ` *]` tail.
    const m = /^\s*=\?\s+(\+\.)?[a-z][a-z0-9-]*\s+!\?=\(\[(.+?)\s+\*\]/.exec(
      lines[i]
    );
    if (!m) continue;
    // The union may be written inline or bound a line or two up, which is what
    // `reel` does: `=/  any  ?(%v0 %v1)`.
    const union = m[2].startsWith('?(')
      ? m[2]
      : lines
          .slice(from, i)
          .find((l) => new RegExp(`^\\s*=/\\s+${m[2]}\\s+\\?\\(`).test(l));
    if (!union) continue;
    const members = Array.from(union.matchAll(/%([a-z0-9][a-z0-9-]*)/g)).map(
      (x) => x[1]
    );
    // The replacement sits after the test, or on the line under it.
    const replacement = /\[%([a-z0-9][a-z0-9-]*)\s/;
    const inject =
      replacement.exec(lines[i].slice(m[0].length)) ??
      replacement.exec(lines[i + 1] ?? '');
    if (members.length > 0 && inject) {
      return { index: m[1] ? 1 : 0, members, inject: inject[1], line: i };
    }
  }
  return null;
}

/**
 * Does anything between the arm header and its `?+` *rewrite* the subject?
 *
 * `lanyard` strips the care and the version off `path` before it dispatches,
 * so the pole its arms are written against is not the pole the client sent;
 * matching the two would report a `MISSING` the agent does not have. The
 * version injection above is the one rewrite this reader models, so it does
 * not count.
 *
 * A guard (`?>`, `?<`, `?.`) is deliberately *not* an obstruction. It can only
 * reject a request the arms would have taken, which weakens what a match
 * means — and a match already promises nothing — but it can never invent an
 * absence.
 */
export function rewritesSubject(
  lines: string[],
  from: number,
  to: number,
  subject: string,
  skipLine?: number
): boolean {
  const head = subject.replace(/^[+-]\./, '');
  // `=.`, `=/`, `=*`, `=+`, `=;` and `=?` all bind. What matters is the face
  // they bind, which is not always spelled bare: `=path` is the shorthand and
  // `path=t.path` names it explicitly, while `t.path` and `+.path` rewrite a
  // wing of it. `other=path` binds `other` — the subject there is only the
  // type, and reading it as a rewrite would withhold every verdict for the
  // surface.
  const wing = new RegExp(`^(?:[a-z0-9@^+>-]+\\.)+${head}$`);
  const binds = (token: string) => {
    const face = /^=?([a-z][a-z0-9-]*)(?:=|$)/.exec(token);
    return face ? face[1] === head : wing.test(token);
  };
  for (let i = from; i < to; i++) {
    if (i === skipLine) continue;
    const m = /^\s*=[./*+;?]\s+(\S+)/.exec(lines[i]);
    if (m && binds(m[1])) return true;
  }
  return false;
}
