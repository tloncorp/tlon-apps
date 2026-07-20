import type { MarkdownRange } from '@expensify/react-native-live-markdown';

// A mention tracked as an entity: a span in the editor text plus the story
// inline it serializes to. This list is the source of truth for "what is a
// mention" — a `~ship`/`@role` in the text is only a mention if it is here
// (because it was picked from the menu or came from the loaded story).
export type MentionInline = { ship: string } | { sect: string | null };

export type Mention = {
  start: number;
  length: number;
  inline: MentionInline;
  // Text shown in the editor for this mention (e.g. a contact's nickname). When
  // absent, the canonical markdown form is used. Only the editor display differs;
  // the mention always serializes from `inline`.
  display?: string;
};

function isShip(inline: MentionInline): inline is { ship: string } {
  return (inline as { ship?: string }).ship !== undefined;
}

// The canonical markdown form of a mention inline (~ship / @all / @role).
export function canonicalText(inline: MentionInline): string {
  if (isShip(inline)) {
    return inline.ship.startsWith('~') ? inline.ship : `~${inline.ship}`;
  }
  return inline.sect === null ? '@all' : `@${inline.sect}`;
}

// The actual text a mention occupies in the editor (its display name if set,
// otherwise the canonical form).
export function displayText(mention: Mention): string {
  return mention.display ?? canonicalText(mention.inline);
}

// storyToMarkdown entity-encodes significant whitespace (e.g. a leading space ->
// `&#x20;`) so it survives markdown parsing. The live-markdown editor shows raw
// markdown, so decode those whitespace entities to characters for display. Only
// whitespace code points are decoded — other entities are left intact so
// markdown-significant text is not reinterpreted (e.g. `&#x3c;` stays as-is).
export function decodeWhitespaceEntities(text: string): string {
  return text.replace(/&#(x[0-9a-fA-F]+|\d+);/g, (match, code: string) => {
    const cp =
      code[0] === 'x' || code[0] === 'X'
        ? parseInt(code.slice(1), 16)
        : parseInt(code, 10);
    if (cp === 0x20 || cp === 0x09 || cp === 0xa0) {
      return String.fromCodePoint(cp);
    }
    return match;
  });
}

// remark-stringify conservatively backslash-escapes markdown-significant
// punctuation. Undo only the escapes that can never change how the text
// re-parses, so the editor doesn't show stray backslashes:
//   - `\_` between two word characters (intra-word underscores are never
//     emphasis in CommonMark, e.g. snake_case)
//   - `\@` (the @ sign is not markdown-significant in this dialect)
// Load-bearing escapes (e.g. `\*`, or `\#`/`\.` at the start of a line) are kept
// so the text still round-trips on save. Uses a capture group rather than
// lookbehind, which Hermes does not support.
export function decodeSafeMarkdownEscapes(text: string): string {
  return text
    .replace(/([A-Za-z0-9])\\_(?=[A-Za-z0-9])/g, '$1_')
    .replace(/\\@/g, '@');
}

// Highlight ranges for the tracked mentions (per-instance, by position).
export function mentionsToRanges(mentions: Mention[]): MarkdownRange[] {
  return mentions.map((mn) => ({
    type: isShip(mn.inline) ? 'mention-user' : 'mention-here',
    start: mn.start,
    length: mn.length,
  }));
}

// Reposition tracked mentions after a text edit; drop any whose span was edited
// or no longer matches its canonical text.
export function updateMentions(
  mentions: Mention[],
  oldText: string,
  newText: string
): Mention[] {
  if (oldText === newText || mentions.length === 0) {
    return mentions;
  }
  const oldLen = oldText.length;
  const newLen = newText.length;
  const minLen = Math.min(oldLen, newLen);

  let prefix = 0;
  while (prefix < minLen && oldText[prefix] === newText[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    oldText[oldLen - 1 - suffix] === newText[newLen - 1 - suffix]
  ) {
    suffix++;
  }
  const oldEditEnd = oldLen - suffix; // edited region in old text: [prefix, oldEditEnd)
  const delta = newLen - oldLen;

  const next: Mention[] = [];
  for (const mn of mentions) {
    const end = mn.start + mn.length;
    let start = mn.start;
    if (end <= prefix) {
      // entirely before the edit — unchanged
    } else if (mn.start >= oldEditEnd) {
      // entirely after the edit — shift by the length delta
      start = mn.start + delta;
    } else {
      // overlaps the edit — the mention text changed, drop it
      continue;
    }
    if (
      start >= 0 &&
      newText.slice(start, start + mn.length) === displayText(mn)
    ) {
      next.push({
        start,
        length: mn.length,
        inline: mn.inline,
        display: mn.display,
      });
    }
  }
  return next;
}

// --- sentinel plumbing (carries mention identity through markdown round-trips) ---

// Private-use chars wrapping an index. They survive remark stringify/parse as
// plain text and never collide with markdown syntax.
const SENTINEL_OPEN = '';
const SENTINEL_CLOSE = '';
const sentinel = (index: number): string =>
  `${SENTINEL_OPEN}${index}${SENTINEL_CLOSE}`;
const SENTINEL_RE = /(\d+)/g;

type LooseInline = string | { [key: string]: unknown };
type LooseVerse = { inline?: LooseInline[]; block?: unknown };

function mapInlines(
  inlines: LooseInline[],
  onMention: (inline: MentionInline) => string
): LooseInline[] {
  return inlines.map((item) => {
    if (item && typeof item === 'object') {
      if ('ship' in item || 'sect' in item) {
        return onMention(item as MentionInline);
      }
      // Nested emphasis etc.: { bold: Inline[] }, { italics: Inline[] }, ...
      const key = Object.keys(item)[0];
      const val = (item as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        return { [key]: mapInlines(val as LooseInline[], onMention) };
      }
    }
    return item;
  });
}

// Replace each ship/sect inline (in inline verses) with a sentinel string,
// collecting the inlines in encounter order. Block verses pass through.
export function sentinelizeStory(story: LooseVerse[]): {
  story: LooseVerse[];
  inlines: MentionInline[];
} {
  const inlines: MentionInline[] = [];
  const newStory = story.map((verse) => {
    if (verse && Array.isArray(verse.inline)) {
      return {
        ...verse,
        inline: mapInlines(verse.inline, (inline) => {
          const i = inlines.length;
          inlines.push(inline);
          return sentinel(i);
        }),
      };
    }
    return verse;
  });
  return { story: newStory, inlines };
}

// Replace sentinel strings in a story's inlines with the corresponding mention
// inlines (inverse of sentinelizeStory's string substitution).
export function injectInlinesIntoStory(
  story: LooseVerse[],
  inlines: MentionInline[]
): LooseVerse[] {
  const splitString = (s: string): LooseInline[] => {
    const parts: LooseInline[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    SENTINEL_RE.lastIndex = 0;
    while ((m = SENTINEL_RE.exec(s)) !== null) {
      if (m.index > last) {
        parts.push(s.slice(last, m.index));
      }
      const inline = inlines[Number(m[1])];
      if (inline) {
        parts.push(inline);
      }
      last = m.index + m[0].length;
    }
    if (parts.length === 0) {
      return [s];
    }
    if (last < s.length) {
      parts.push(s.slice(last));
    }
    return parts;
  };
  const walk = (arr: LooseInline[]): LooseInline[] =>
    arr.flatMap((item) => {
      if (typeof item === 'string') {
        return splitString(item);
      }
      if (item && typeof item === 'object') {
        const key = Object.keys(item)[0];
        const val = (item as Record<string, unknown>)[key];
        if (Array.isArray(val)) {
          return [{ [key]: walk(val as LooseInline[]) }];
        }
      }
      return [item];
    });
  return story.map((verse) =>
    verse && Array.isArray(verse.inline)
      ? { ...verse, inline: walk(verse.inline) }
      : verse
  );
}

// Replace each tracked mention span in the text with a sentinel, returning the
// sentinel text and the inlines in sentinel-index order.
export function replaceMentionSpansWithSentinels(
  text: string,
  mentions: Mention[]
): { text: string; inlines: MentionInline[] } {
  const sorted = [...mentions].sort((a, b) => a.start - b.start);
  const inlines: MentionInline[] = [];
  let result = '';
  let last = 0;
  sorted.forEach((mn) => {
    if (mn.start < last) {
      return; // overlapping/stale — skip
    }
    result += text.slice(last, mn.start);
    result += sentinel(inlines.length);
    inlines.push(mn.inline);
    last = mn.start + mn.length;
  });
  result += text.slice(last);
  return { text: result, inlines };
}

// Replace sentinels in text with the mention's display text, recording the
// spans. `displayFor` chooses the shown text (e.g. a contact's nickname);
// without it the canonical form is used.
export function extractMentionsFromSentinelText(
  text: string,
  inlines: MentionInline[],
  displayFor?: (inline: MentionInline) => string
): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  let result = '';
  let last = 0;
  let m: RegExpExecArray | null;
  SENTINEL_RE.lastIndex = 0;
  while ((m = SENTINEL_RE.exec(text)) !== null) {
    result += text.slice(last, m.index);
    const inline = inlines[Number(m[1])];
    if (inline) {
      const display = displayFor ? displayFor(inline) : canonicalText(inline);
      mentions.push({
        start: result.length,
        length: display.length,
        inline,
        display,
      });
      result += display;
    }
    last = m.index + m[0].length;
  }
  result += text.slice(last);
  return { text: result, mentions };
}
