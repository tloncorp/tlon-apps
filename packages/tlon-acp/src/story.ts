export type TlonStory = Array<Record<string, unknown>>;

export function plainStory(text: string): TlonStory {
  return [{ inline: [text] }];
}

export function extractStoryText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map(extractVerse).filter(Boolean).join('\n').trim();
}

function extractVerse(value: unknown): string {
  const verse = asRecord(value);
  if (Array.isArray(verse.inline)) return extractInline(verse.inline);
  if ('block' in verse) return extractUnknownText(verse.block);
  return '';
}

function extractInline(items: unknown[]): string {
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      const value = asRecord(item);
      if (typeof value.ship === 'string') return value.ship;
      if ('sect' in value) return `@${String(value.sect || 'all')}`;
      if ('break' in value) return '\n';
      if (typeof value['inline-code'] === 'string') {
        return `\`${value['inline-code']}\``;
      }
      if (typeof value.code === 'string') return `\`${value.code}\``;
      for (const key of ['bold', 'italics', 'strike', 'blockquote']) {
        if (Array.isArray(value[key])) return extractInline(value[key]);
      }
      const link = asRecord(value.link);
      if (typeof link.content === 'string') return link.content;
      if (typeof link.href === 'string') return link.href;
      return '';
    })
    .join('');
}

function extractUnknownText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractUnknownText).join('\n');
  const object = asRecord(value);
  return Object.values(object)
    .map(extractUnknownText)
    .filter(Boolean)
    .join('\n');
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
