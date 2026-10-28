import { type Cite } from '@tloncorp/api';
import { valid } from '@urbit/aura';

/**
 * A reference path, as the app's composer recognises it when one is pasted:
 * `/1/group/~host/slug`, `/1/chan/<nest>/...`, `/1/desk/...`. The app converts
 * these to a cite on the way out, so text carrying one renders as a reference
 * card rather than as the raw path — do the same for anything we send.
 */
const REF_PATH_REGEX = /^\/1\/(?:chan|group|desk)\/[^\s]+/;
/** Unanchored, to find where a reference starts inside a run of prose. */
const REF_PATH_START_REGEX = /\/1\/(?:chan|group|desk)\//;
// Prose ends sentences after a path — "See /1/group/~ten/workspace." — and
// closes quotations around one; neither the punctuation nor the closing quote
// is part of the reference.
const REF_TRAILING_PUNCTUATION = '.,;:!?)]"\'\u201D\u2019\u00BB';

/** A slug as the wire accepts it: a Hoon sym is lowercase, no underscores. */
const REF_SYM_REGEX = /^[a-z][a-z0-9-]*$/;
/**
 * A canonical post id: a plain numeral, or dot-grouped in exact threes with a
 * nonzero leading group. Recipients strip the dots when resolving, so `1..2`,
 * `1.2`, `012` or `0.001` would point at a different post — reject them.
 */
const REF_ID_REGEX = /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/;
const REF_CHAN_KINDS = ['chat', 'heap', 'diary', 'notes'];

/**
 * Whether a chan cite's `where` locates something the app renders, for the
 * given channel kind: a post (`/msg/...`, plus `/curio/...` for heaps and
 * `/note/...` for diaries and notebooks), each optionally with a reply id as
 * a second segment — except notebook notes, which have no reply concept. A
 * bare channel `where` renders nothing, so it is not accepted.
 */
function isValidChanWhere(kind: string, where: string): boolean {
  const parts = where.split('/');
  if (parts[0] !== '' || parts.length < 3) {
    return false;
  }
  const head = parts[1];
  if (head === 'msg') {
    if (kind === 'notes') {
      return false;
    }
    if (parts.length === 3) {
      return REF_ID_REGEX.test(parts[2]);
    }
    if (parts.length === 4) {
      // `/msg/<id>/<id>`, or the legacy `/msg/~author/<id>`.
      if (parts[2].startsWith('~')) {
        return valid('p', parts[2]) && REF_ID_REGEX.test(parts[3]);
      }
      return REF_ID_REGEX.test(parts[2]) && REF_ID_REGEX.test(parts[3]);
    }
    return false;
  }
  // `/curio/<id>` and `/note/<id>`, each optionally with a reply id as a
  // second segment (notebook notes excepted); unlike `/msg`, neither has a
  // `~author` variant.
  if (
    (parts.length !== 3 && parts.length !== 4) ||
    !REF_ID_REGEX.test(parts[2]) ||
    (parts.length === 4 && !REF_ID_REGEX.test(parts[3]))
  ) {
    return false;
  }
  if (head === 'curio') {
    return kind === 'heap';
  }
  if (head === 'note') {
    if (kind === 'diary') {
      return true;
    }
    // A notebook NoteReference carries only a noteId and the renderer ignores
    // anything after `/note/<id>`, so a reply id would silently point the
    // card at the wrong note.
    return kind === 'notes' && parts.length === 3;
  }
  return false;
}

/**
 * Validate a reference path before it is emitted as a cite. A wire-invalid
 * cite fails more than itself: a group slug that is not a valid Hoon sym
 * makes the ship's JSON decoder reject the ENTIRE poke, so the whole send
 * fails; desk cites render as "App references are not yet supported" error
 * cards; free-form chan `where` paths render nothing. Only the canonical,
 * render-accepted forms pass — everything else returns null so the caller
 * keeps the path as literal text.
 */
function pathToValidatedCite(path: string): Cite | null {
  const segments = path.split('/');
  if (segments[0] !== '' || segments[1] !== '1') {
    return null;
  }
  if (segments[2] === 'group') {
    // /1/group/~ship/slug — exactly five segments.
    if (segments.length !== 5) {
      return null;
    }
    const ship = segments[3];
    const slug = segments[4];
    if (!valid('p', ship) || !REF_SYM_REGEX.test(slug)) {
      return null;
    }
    return { group: `${ship}/${slug}` };
  }
  if (segments[2] === 'chan') {
    // /1/chan/<kind>/~host/<name><where>, with <where> locating a post.
    if (segments.length < 6) {
      return null;
    }
    const kind = segments[3];
    const host = segments[4];
    const name = segments[5];
    if (
      !REF_CHAN_KINDS.includes(kind) ||
      !valid('p', host) ||
      !REF_SYM_REGEX.test(name)
    ) {
      return null;
    }
    const where = segments.length > 6 ? `/${segments.slice(6).join('/')}` : '';
    if (!isValidChanWhere(kind, where)) {
      return null;
    }
    return { chan: { nest: `${kind}/${host}/${name}`, where } };
  }
  // desk cites render as error cards; never emit one.
  return null;
}

/**
 * Tlon Story Format - Rich text converter
 *
 * Converts markdown-like text to Tlon's story format.
 */

// Inline content types
export type StoryInline =
  | string
  | { bold: StoryInline[] }
  | { italics: StoryInline[] }
  | { strike: StoryInline[] }
  | { blockquote: StoryInline[] }
  | { 'inline-code': string }
  | { code: string }
  | { ship: string }
  | { link: { href: string; content: string } }
  | { break: null }
  | { tag: string }
  | { sect: string | null };

// Block content types
export type StoryBlock =
  | {
      header: {
        tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        content: StoryInline[];
      };
    }
  | { code: { code: string; lang: string } }
  | { image: { src: string; height: number; width: number; alt: string } }
  | { cite: Cite }
  | { rule: null }
  | { listing: StoryListing };

export type StoryListing =
  | {
      list: {
        type: 'ordered' | 'unordered' | 'tasklist';
        items: StoryListing[];
        contents: StoryInline[];
      };
    }
  | { item: StoryInline[] };

// A verse is either a block or inline content
export type StoryVerse = { block: StoryBlock } | { inline: StoryInline[] };

// A story is a list of verses
export type Story = StoryVerse[];

/**
 * Matches `[label](url)` or `![alt](url)` at the start of `text`. The URL may
 * hold balanced parentheses, as in .../wiki/Function_(mathematics).
 */
function matchMarkdownDestination(
  text: string,
  image: boolean,
  labelEnd: number,
  closingParen: (open: number) => number
): [whole: string, label: string, url: string] | null {
  // The caller finds the first `]` and the `)` matching each `(` once per
  // text, so a run of unclosed `[` or `[x](` is not rescanned from each one.
  const labelStart = image ? 2 : 1;
  if (
    !text.startsWith(image ? '![' : '[') ||
    labelEnd < (image ? labelStart : labelStart + 1) ||
    text[labelEnd + 1] !== '('
  ) {
    return null;
  }
  const label = text.slice(labelStart, labelEnd);
  const start = labelEnd + 2;
  const end = closingParen(labelEnd + 1);
  return end > start
    ? [text.slice(0, end + 1), label, text.slice(start, end)]
    : null;
}

/**
 * For each `(` in text, the index of the `)` that balances it, or -1.
 * A backslash escapes the character after it.
 */
function matchParens(text: string): Int32Array {
  const closes = new Int32Array(text.length).fill(-1);
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === '(') {
      open.push(i);
    } else if (text[i] === ')' && open.length > 0) {
      closes[open.pop()!] = i;
    }
  }
  return closes;
}

/** `text` without its trailing run of `chars`, scanned right to left. */
function trimTrailing(text: string, chars: string): string {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end--;
  return text.slice(0, end);
}

/**
 * In running prose a bare URL never ends in sentence punctuation or a stray
 * paren. A closing paren ends the URL only when it balances one inside it.
 */
function matchBareUrl(text: string): string | null {
  let url = /^https?:\/\/[^\s<>"\]]+/.exec(text)?.[0];
  if (!url) {
    return null;
  }
  let unbalanced = url.split(')').length - url.split('(').length;
  while (/[.,;:!?(]$/.test(url) || (url.endsWith(')') && unbalanced > 0)) {
    unbalanced += url.endsWith(')') ? -1 : url.endsWith('(') ? 1 : 0;
    url = url.slice(0, -1);
  }
  return /^https?:\/\/./.test(url) ? url : null;
}

type PlainTextStop = string | RegExp;

/**
 * Where a plain-text run must end so a later rule can claim what follows:
 * markdown tokens, a URL start (so "https" is not swallowed before "://"),
 * and a reference path start.
 */
const PLAIN_TEXT_STOPS: readonly PlainTextStop[] = [
  '**',
  '__',
  '~~',
  '`',
  '[',
  '!',
  '~',
  '\n',
  '*',
  '_',
  /https?:\/\//g,
  new RegExp(REF_PATH_START_REGEX.source, 'g'),
];

/**
 * Parse inline markdown formatting (bold, italic, code, links, mentions)
 */
/**
 * `allowRefs` is true only for the top level of a paragraph. A reference is
 * hoisted to a cite *block*, and only processInlinesForBlocks does that, on
 * top-level inlines. Inside bold, a heading or a blockquote the marker would
 * never be hoisted and would go out as an inline Tlon does not have, failing
 * the whole message — so there the path stays as the text it was.
 */
function parseInlineMarkdown(
  text: string,
  { allowRefs = true }: { allowRefs?: boolean } = {}
): StoryInline[] {
  const result: StoryInline[] = [];
  let remaining = text;
  // Absolute index of each stop's next occurrence, reused until the parser
  // passes it: searching the whole tail again at every step is quadratic.
  const stopCache = new Map<PlainTextStop, number>();
  const nextStop = (stop: PlainTextStop, from: number): number => {
    const cached = stopCache.get(stop);
    if (cached !== undefined && (cached === -1 || cached >= from)) {
      return cached;
    }
    let found: number;
    if (typeof stop === 'string') {
      found = text.indexOf(stop, from);
    } else {
      stop.lastIndex = from;
      found = stop.exec(text)?.index ?? -1;
    }
    stopCache.set(stop, found);
    return found;
  };
  let parenCloses: Int32Array | undefined;
  const closingParen = (open: number): number => {
    const pos = text.length - remaining.length;
    parenCloses ??= matchParens(text);
    const close = parenCloses[pos + open];
    return close < 0 ? -1 : close - pos;
  };
  const labelEnd = (): number => {
    const pos = text.length - remaining.length;
    const found = nextStop(']', pos);
    return found < 0 ? -1 : found - pos;
  };

  while (remaining.length > 0) {
    // Ship mentions: ~sampel-palnet
    const shipMatch = remaining.match(/^(~[a-z][-a-z0-9]*)/);
    if (shipMatch && valid('p', shipMatch[1])) {
      result.push({ ship: shipMatch[1] });
      remaining = remaining.slice(shipMatch[0].length);
      continue;
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*|^__(.+?)__/);
    if (boldMatch) {
      const content = boldMatch[1] || boldMatch[2];
      result.push({ bold: parseInlineMarkdown(content, { allowRefs: false }) });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italics: *text* or _text_ (but not inside words for _)
    const italicsMatch = remaining.match(
      /^\*([^*]+?)\*|^_([^_]+?)_(?![a-zA-Z0-9])/
    );
    if (italicsMatch) {
      const content = italicsMatch[1] || italicsMatch[2];
      result.push({
        italics: parseInlineMarkdown(content, { allowRefs: false }),
      });
      remaining = remaining.slice(italicsMatch[0].length);
      continue;
    }

    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      result.push({
        strike: parseInlineMarkdown(strikeMatch[1], { allowRefs: false }),
      });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      result.push({ 'inline-code': codeMatch[1] });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Links: [text](url)
    const linkMatch = matchMarkdownDestination(
      remaining,
      false,
      labelEnd(),
      closingParen
    );
    if (linkMatch) {
      result.push({ link: { href: linkMatch[2], content: linkMatch[1] } });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Reference paths, hoisted to a cite block like images below.
    const refMatch = remaining.match(REF_PATH_REGEX);
    if (refMatch) {
      const path = trimTrailing(refMatch[0], REF_TRAILING_PUNCTUATION);
      if (!allowRefs) {
        // Consumed whole as text so the ship-mention scanner cannot claim
        // the host out of the middle of the path.
        result.push(path);
        remaining = remaining.slice(path.length);
        continue;
      }
      const cite = pathToValidatedCite(path);
      if (cite) {
        result.push({ __cite: cite } as unknown as StoryInline);
        remaining = remaining.slice(path.length);
        continue;
      }
      // A recognised but incomplete or wire-invalid path. Keep the whole match
      // as literal text: left to fall through, `/1/group/` would be consumed
      // as text and the ship after it claimed as a mention the author never
      // made.
      result.push(refMatch[0]);
      remaining = remaining.slice(refMatch[0].length);
      continue;
    }

    // Markdown images: ![alt](url)
    const imageMatch = matchMarkdownDestination(
      remaining,
      true,
      labelEnd(),
      closingParen
    );
    if (imageMatch) {
      // Return a special marker that will be hoisted to a block
      result.push({
        __image: { src: imageMatch[2], alt: imageMatch[1] },
      } as unknown as StoryInline);
      remaining = remaining.slice(imageMatch[0].length);
      continue;
    }

    // Plain URL detection
    const url = matchBareUrl(remaining);
    if (url) {
      result.push({ link: { href: url, content: url } });
      remaining = remaining.slice(url.length);
      continue;
    }

    // Hashtags: #tag - disabled, chat UI doesn't render them
    // const tagMatch = remaining.match(/^#([a-zA-Z][a-zA-Z0-9_-]*)/);
    // if (tagMatch) {
    //   result.push({ tag: tagMatch[1] });
    //   remaining = remaining.slice(tagMatch[0].length);
    //   continue;
    // }

    // Plain text: consume until the next stop.
    const pos = text.length - remaining.length;
    const specialTokenIndices = PLAIN_TEXT_STOPS.map((stop) =>
      nextStop(stop, pos)
    ).filter((idx) => idx >= 0);

    const nextTokenIndex =
      specialTokenIndices.length > 0
        ? Math.min(...specialTokenIndices) - pos
        : -1;

    if (nextTokenIndex > 0) {
      result.push(remaining.slice(0, nextTokenIndex));
      remaining = remaining.slice(nextTokenIndex);
      continue;
    }

    // Single character fallback
    result.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  // Merge adjacent strings
  return mergeAdjacentStrings(result);
}

/**
 * Merge adjacent string elements in an inline array
 */
function mergeAdjacentStrings(inlines: StoryInline[]): StoryInline[] {
  const result: StoryInline[] = [];
  for (const item of inlines) {
    if (
      typeof item === 'string' &&
      typeof result[result.length - 1] === 'string'
    ) {
      result[result.length - 1] = (result[result.length - 1] as string) + item;
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Create an image block
 */
export function createImageBlock(
  src: string,
  alt: string = '',
  height: number = 0,
  width: number = 0
): StoryVerse {
  return {
    block: {
      image: { src, height, width, alt },
    },
  };
}

/**
 * Stories carry images only as blocks, so move every image marker out of its
 * inline context, at any depth, and drop the styles it leaves empty.
 */
function hoistImageMarkers(
  inlines: StoryInline[],
  blocks: StoryVerse[]
): StoryInline[] {
  const hoisted: StoryInline[] = [];
  for (const inline of inlines) {
    if (typeof inline !== 'object') {
      hoisted.push(inline);
    } else if ('__image' in inline) {
      const img = (
        inline as unknown as { __image: { src: string; alt: string } }
      ).__image;
      blocks.push(createImageBlock(img.src, img.alt));
    } else {
      const key = WRAPPERS.find((k) => k in inline);
      if (!key) {
        hoisted.push(inline);
        continue;
      }
      const content = hoistImageMarkers(
        (inline as Record<typeof key, StoryInline[]>)[key],
        blocks
      );
      if (content.length > 0) {
        hoisted.push({ [key]: content } as StoryInline);
      }
    }
  }
  return mergeAdjacentStrings(hoisted);
}

/**
 * Process inlines and extract image and reference markers into blocks
 */
function processInlinesForBlocks(inlines: StoryInline[]): {
  inlines: StoryInline[];
  blocks: StoryVerse[];
} {
  const cleanInlines: StoryInline[] = [];
  const blocks: StoryVerse[] = [];

  for (const inline of inlines) {
    if (typeof inline === 'object' && '__cite' in inline) {
      const { __cite: cite } = inline as unknown as { __cite: Cite };
      blocks.push({ block: { cite } });
    } else {
      cleanInlines.push(...hoistImageMarkers([inline], blocks));
    }
  }

  return { inlines: cleanInlines, blocks };
}

/**
 * The group roles a message may mention. `@all` always converts; an empty
 * set means `@all` only, which is all a DM has.
 */
export type RoleMentionScope = { roleIds: ReadonlySet<string> };

export const ALL_ONLY: RoleMentionScope = { roleIds: new Set() };

/**
 * Mirrors the role-mention rule the tlon CLI applies: a case-insensitive id
 * (matched lowercased), no letter, digit or backslash before `@` (emails,
 * `abc@foo`, an escaped `\@all`), and no letter, digit, `_` or `-` after
 * the token (`@admin_team`, `@all-_x`), so a partial word never converts.
 * The api's markdown parser carries the same rule in its own regex, where
 * `\@` is an escape that yields a literal `@`; this parser does no escape
 * handling, so the backslash stays visible, but the mention is suppressed
 * either way. OpenClaw cannot import the api's regex at runtime.
 */
const ROLE_MENTION_TOKEN =
  /(?<![A-Za-z0-9\\])@([A-Za-z][A-Za-z0-9-]*)(?![A-Za-z0-9_-])/g;

/**
 * The lowercase `@tokens` in raw text other than `all`: the role ids a
 * message might mention. Empty means no role lookup is needed.
 */
export function roleMentionCandidates(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of text.matchAll(ROLE_MENTION_TOKEN)) {
    const id = match[1].toLowerCase();
    if (id !== 'all') tokens.add(id);
  }
  return tokens;
}

/**
 * How the text on one side of a string inline ends: a ship renders as a
 * word (`~zod@all` is not a mention), while a break, code, a link or the
 * edge of a block separates.
 */
type Edge = 'word' | 'boundary';

type RoleMentionLeaf =
  | { kind: 'text'; text: string }
  | { kind: 'edge'; edge: Edge };

const WRAPPERS = ['bold', 'italics', 'strike', 'blockquote'] as const;

function wrappedInlines(inline: StoryInline): StoryInline[] | null {
  if (typeof inline !== 'object' || inline === null) return null;
  for (const key of WRAPPERS) {
    if (key in inline) {
      return (inline as Record<string, StoryInline[]>)[key];
    }
  }
  return null;
}

function collectLeaves(inlines: StoryInline[], leaves: RoleMentionLeaf[]) {
  for (const inline of inlines) {
    if (typeof inline === 'string') {
      leaves.push({ kind: 'text', text: inline });
      continue;
    }
    const children = wrappedInlines(inline);
    if (children) {
      collectLeaves(children, leaves);
    } else if ('ship' in inline || 'tag' in inline) {
      leaves.push({ kind: 'edge', edge: 'word' });
    } else {
      leaves.push({ kind: 'edge', edge: 'boundary' });
    }
  }
}

/**
 * Whether the rendered text runs on into the token across the inline
 * boundary. Formatting wrappers are transparent, so `**~zod**@all` and
 * `@admin__team__` are judged by the ship and the `t` beside them.
 */
function neighbourJoins(
  leaves: RoleMentionLeaf[],
  from: number,
  step: 1 | -1,
  joins: RegExp
): boolean {
  for (let i = from + step; i >= 0 && i < leaves.length; i += step) {
    const leaf = leaves[i];
    if (leaf.kind === 'edge') return leaf.edge === 'word';
    if (leaf.text.length === 0) continue;
    return joins.test(step === 1 ? leaf.text[0] : leaf.text.at(-1)!);
  }
  return false;
}

/** Each raw occurrence's marker, mapped to the token as the raw text had it. */
type RoleMentionMarks = { pattern: RegExp; tokens: Map<string, string> };

function convertText(
  text: string,
  before: boolean,
  after: boolean,
  marks: RoleMentionMarks,
  roleIds: ReadonlySet<string>
): StoryInline[] {
  // Pad with stand-ins for the neighbours so the token regex applies its
  // own boundary rule across inlines: `a` blocks a match after it and `_`
  // blocks one before it, and neither can be absorbed into a token.
  const padded = `${before ? 'a' : ' '}${text}${after ? '_' : ' '}`;
  const result: StoryInline[] = [];
  let last = 1;
  for (const match of padded.matchAll(marks.pattern)) {
    // A token the parser cut short (`@adminhttps://x` scans as `@admin`
    // and a link) is not the token the raw text was judged on.
    if (marks.tokens.get(match[1]) !== match[2]) continue;
    const id = match[2].toLowerCase();
    if (id !== 'all' && !roleIds.has(id)) continue;
    if (match.index > last) result.push(padded.slice(last, match.index));
    result.push({ sect: id === 'all' ? null : id });
    last = match.index + match[0].length;
  }
  if (last === 1) return [text];
  if (last < padded.length - 1) result.push(padded.slice(last, -1));
  return result;
}

/**
 * Convert the marked `@all` and known role ids in one run of inlines (a
 * paragraph, a heading) to sect inlines. Every other token stays as typed.
 */
function applyRoleMentionsToInlines(
  inlines: StoryInline[],
  marks: RoleMentionMarks,
  roleIds: ReadonlySet<string>
): StoryInline[] {
  const leaves: RoleMentionLeaf[] = [];
  collectLeaves(inlines, leaves);
  const converted = leaves.map((leaf, i) =>
    leaf.kind === 'text'
      ? convertText(
          leaf.text,
          neighbourJoins(leaves, i, -1, /[A-Za-z0-9\\]/),
          neighbourJoins(leaves, i, 1, /[A-Za-z0-9_-]/),
          marks,
          roleIds
        )
      : null
  );
  // Rebuild in the same order collectLeaves walked.
  let cursor = 0;
  const rebuild = (items: StoryInline[]): StoryInline[] =>
    items.flatMap((inline): StoryInline[] => {
      if (typeof inline === 'string') return converted[cursor++]!;
      const children = wrappedInlines(inline);
      if (!children) {
        cursor++;
        return [inline];
      }
      const key = WRAPPERS.find((k) => k in inline)!;
      return [{ [key]: rebuild(children) } as StoryInline];
    });
  return rebuild(inlines);
}

/** Put every marker that did not become a sect back to `@`, wherever it is. */
function unmark<T>(value: T, markers: RegExp): T {
  if (typeof value === 'string') {
    return value.replace(markers, '@') as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => unmark(item, markers)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, unmark(item, markers)])
    ) as T;
  }
  return value;
}

const MARKER_FIRST = 0xe000;
const MARKER_LAST = 0xf8ff;

/**
 * Parse with role mentions converted. A post-pass rather than a parser arm:
 * the plain-text scanner does not stop at `@`, and teaching it to would
 * re-segment text for every caller.
 *
 * Eligibility is decided per occurrence on the raw text, with the same
 * regex the lookup gate uses: each raw match has its `@` swapped for its
 * own private-use marker before parsing, and only a marked token that
 * survives parsing whole can convert. The parser treats a marker exactly as
 * it treats `@`, so the story is otherwise unchanged. Without this, removing
 * formatting (`@all__!__`), a scanner split (`@adminhttps://x`) or the same
 * token elsewhere in code could turn an occurrence the gate rejected into a
 * mention. Markers inside code, links and unconverted text are put back
 * afterwards. The pass then applies the boundary rule across inlines, which
 * formatting can only make stricter.
 */
function storyWithRoleMentions(
  markdown: string,
  { roleIds }: RoleMentionScope
): Story {
  const tokens = new Map<string, string>();
  let code = MARKER_FIRST;
  const markedMarkdown = markdown.replace(
    ROLE_MENTION_TOKEN,
    (match, token) => {
      while (
        code <= MARKER_LAST &&
        markdown.includes(String.fromCharCode(code))
      )
        code++;
      // Out of markers: the rest stay plain text.
      if (code > MARKER_LAST) return match;
      const marker = String.fromCharCode(code++);
      tokens.set(marker, token);
      return marker + token;
    }
  );
  if (tokens.size === 0) return parseMarkdownStory(markdown);
  const markerClass = `[${[...tokens.keys()].join('')}]`;
  const marks: RoleMentionMarks = {
    pattern: new RegExp(
      ROLE_MENTION_TOKEN.source.replace('@', `(${markerClass})`),
      'g'
    ),
    tokens,
  };
  const story = parseMarkdownStory(markedMarkdown).map((verse): StoryVerse => {
    if ('inline' in verse) {
      return {
        inline: applyRoleMentionsToInlines(verse.inline, marks, roleIds),
      };
    }
    if ('header' in verse.block) {
      const { header } = verse.block;
      return {
        block: {
          header: {
            ...header,
            content: applyRoleMentionsToInlines(header.content, marks, roleIds),
          },
        },
      };
    }
    return verse;
  });
  return unmark(story, new RegExp(markerClass, 'g'));
}

/**
 * Convert markdown text to Tlon story format.
 *
 * `@all` and group role mentions convert only when `roleMentions` is passed,
 * which callers do for model-authored text; without it the output is
 * unchanged and every `@word` stays text.
 */
export function markdownToStory(
  markdown: string,
  options: { roleMentions?: RoleMentionScope } = {}
): Story {
  return options.roleMentions
    ? storyWithRoleMentions(markdown, options.roleMentions)
    : parseMarkdownStory(markdown);
}

/**
 * An opening code fence: three or more backticks and an info string with no
 * backtick (CommonMark 4.5), so ```literal``` stays an inline code span.
 */
function matchFenceOpener(line: string): RegExpMatchArray | null {
  return line.match(/^(`{3,})([^`]*)$/);
}

/**
 * `\s` and `\S` cannot overlap, so a long run of spaces before a character
 * `.` rejects (a lone \r, U+2028) fails in linear time instead of trying
 * every split of the run.
 */
const HEADING_REGEX = /^(#{1,6})\s+(\S.*)$/;

function parseMarkdownStory(markdown: string): Story {
  const story: Story = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block: ```lang\ncode\n```. Only a line of at least as many
    // backticks closes it, so a longer fence can carry ``` lines as content.
    const fenceMatch = matchFenceOpener(line);
    if (fenceMatch) {
      const closingFence = new RegExp(`^\`{${fenceMatch[1].length},}\\s*$`);
      // The ship decodes lang as a @tas, so anything else would fail the poke.
      const info = fenceMatch[2].trim().toLowerCase();
      const lang = /^[a-z][a-z0-9-]*$/.test(info) ? info : 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !closingFence.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      story.push({
        block: {
          code: {
            code: codeLines.join('\n'),
            lang,
          },
        },
      });
      i++; // skip closing fence
      continue;
    }

    // Headers: # H1, ## H2, etc.
    const headerMatch = line.match(HEADING_REGEX);
    if (headerMatch) {
      const level = headerMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const imageBlocks: StoryVerse[] = [];
      const content = hoistImageMarkers(
        parseInlineMarkdown(headerMatch[2], { allowRefs: false }),
        imageBlocks
      );
      if (content.length > 0) {
        story.push({ block: { header: { tag, content } } });
      }
      story.push(...imageBlocks);
      i++;
      continue;
    }

    // Horizontal rule: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      story.push({ block: { rule: null } });
      i++;
      continue;
    }

    // Blockquote: > text
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      const quoteText = quoteLines.join('\n');
      const imageBlocks: StoryVerse[] = [];
      const inline = hoistImageMarkers(
        [{ blockquote: parseInlineMarkdown(quoteText, { allowRefs: false }) }],
        imageBlocks
      );
      if (inline.length > 0) {
        story.push({ inline });
      }
      story.push(...imageBlocks);
      continue;
    }

    // Empty line - skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph - collect consecutive non-empty lines
    // The first line is always taken: no branch above claimed it, so
    // excluding it here would leave i unadvanced and spin forever.
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      (paragraphLines.length === 0 ||
        (lines[i].trim() !== '' &&
          !HEADING_REGEX.test(lines[i]) &&
          !matchFenceOpener(lines[i]) &&
          !lines[i].startsWith('> ') &&
          !/^(-{3,}|\*{3,})$/.test(lines[i].trim())))
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      const paragraphText = paragraphLines.join('\n');
      // Convert newlines within paragraph to break elements
      const inlines = parseInlineMarkdown(paragraphText);
      // Replace \n in strings with break elements
      const withBreaks: StoryInline[] = [];
      for (const inline of inlines) {
        if (typeof inline === 'string' && inline.includes('\n')) {
          const parts = inline.split('\n');
          for (let j = 0; j < parts.length; j++) {
            if (parts[j]) {
              withBreaks.push(parts[j]);
            }
            if (j < parts.length - 1) {
              withBreaks.push({ break: null });
            }
          }
        } else {
          withBreaks.push(inline);
        }
      }

      // Extract any images from inlines and add as separate blocks
      const { inlines: cleanInlines, blocks } =
        processInlinesForBlocks(withBreaks);

      if (cleanInlines.length > 0) {
        story.push({ inline: cleanInlines });
      }
      story.push(...blocks);
    }
  }

  return story;
}

/**
 * Convert plain text to simple story (no markdown parsing)
 */
export function textToStory(text: string): Story {
  return [{ inline: [text] }];
}

/**
 * Check if text contains markdown formatting
 */
export function hasMarkdown(text: string): boolean {
  // Check for common markdown patterns
  return /(\*\*|__|~~|`|^#{1,6}\s|^```|^\s*[-*]\s|\[.*\]\(.*\)|^>\s)/m.test(
    text
  );
}
