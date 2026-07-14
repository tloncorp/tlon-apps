/**
 * Flatten a Tlon story (list of verses) to plain-ish markdown text.
 * Adapted from the OpenClaw Tlon plugin's extractMessageText.
 */

function extractInlineText(inlines: unknown[]): string {
  return inlines
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (!item || typeof item !== 'object') {
        return '';
      }
      const inline = item as Record<string, unknown>;
      if (typeof inline.ship === 'string') {
        return inline.ship;
      }
      if ('sect' in inline) {
        return `@${inline.sect || 'all'}`;
      }
      if (inline.break !== undefined) {
        return '\n';
      }
      const link = inline.link as { href?: string } | undefined;
      if (link?.href) {
        return link.href;
      }
      if (typeof inline['inline-code'] === 'string') {
        return `\`${inline['inline-code']}\``;
      }
      if (typeof inline.code === 'string') {
        return `\`${inline.code}\``;
      }
      if (Array.isArray(inline.bold)) {
        return `**${extractInlineText(inline.bold)}**`;
      }
      if (Array.isArray(inline.italics)) {
        return `*${extractInlineText(inline.italics)}*`;
      }
      if (Array.isArray(inline.strike)) {
        return `~~${extractInlineText(inline.strike)}~~`;
      }
      if (Array.isArray(inline.blockquote)) {
        return `> ${extractInlineText(inline.blockquote)}`;
      }
      return '';
    })
    .join('');
}

export function extractStoryText(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((verse) => {
      if (!verse || typeof verse !== 'object') {
        return '';
      }
      const v = verse as Record<string, unknown>;
      if (Array.isArray(v.inline)) {
        return extractInlineText(v.inline);
      }
      if (v.block && typeof v.block === 'object') {
        const block = v.block as Record<string, unknown>;
        const image = block.image as { src?: string; alt?: string } | undefined;
        if (image?.src) {
          return `[image: ${image.alt || image.src}]`;
        }
        const code = block.code as { code?: string } | undefined;
        if (code?.code) {
          return `\`\`\`\n${code.code}\n\`\`\``;
        }
        if (block.cite) {
          return '[quoted message]';
        }
      }
      return '';
    })
    .filter((line) => line !== '')
    .join('\n');
}
