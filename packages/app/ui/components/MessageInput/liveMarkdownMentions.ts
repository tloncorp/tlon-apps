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
};

function isShip(inline: MentionInline): inline is { ship: string } {
  return (inline as { ship?: string }).ship !== undefined;
}

// The text a mention occupies in the editor (canonical markdown form).
export function canonicalText(inline: MentionInline): string {
  if (isShip(inline)) {
    return inline.ship.startsWith('~') ? inline.ship : `~${inline.ship}`;
  }
  return inline.sect === null ? '@all' : `@${inline.sect}`;
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
      newText.slice(start, start + mn.length) === canonicalText(mn.inline)
    ) {
      next.push({ start, length: mn.length, inline: mn.inline });
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

// Replace sentinels in text with canonical mention text, recording the spans.
export function extractMentionsFromSentinelText(
  text: string,
  inlines: MentionInline[]
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
      const canon = canonicalText(inline);
      mentions.push({ start: result.length, length: canon.length, inline });
      result += canon;
    }
    last = m.index + m[0].length;
  }
  result += text.slice(last);
  return { text: result, mentions };
}
