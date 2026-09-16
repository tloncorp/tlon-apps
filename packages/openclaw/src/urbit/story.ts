import { type Cite, pathToCite } from '@tloncorp/api';
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
const REF_TRAILING_PUNCTUATION = /[.,;:!?)\]"'\u201D\u2019\u00BB]+$/;

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
  | { tag: string };

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
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      result.push({ link: { href: linkMatch[2], content: linkMatch[1] } });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Reference paths, hoisted to a cite block like images below.
    const refMatch = remaining.match(REF_PATH_REGEX);
    if (refMatch) {
      const path = refMatch[0].replace(REF_TRAILING_PUNCTUATION, '');
      if (!allowRefs) {
        // Consumed whole as text so the ship-mention scanner cannot claim
        // the host out of the middle of the path.
        result.push(path);
        remaining = remaining.slice(path.length);
        continue;
      }
      const cite = pathToCite(path);
      if (cite) {
        result.push({ __cite: cite } as unknown as StoryInline);
        remaining = remaining.slice(path.length);
        continue;
      }
      // Unparseable: fall through and keep it as literal text rather than
      // dropping something the author meant to send.
    }

    // Markdown images: ![alt](url)
    const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      // Return a special marker that will be hoisted to a block
      result.push({
        __image: { src: imageMatch[2], alt: imageMatch[1] },
      } as unknown as StoryInline);
      remaining = remaining.slice(imageMatch[0].length);
      continue;
    }

    // Plain URL detection
    const urlMatch = remaining.match(/^(https?:\/\/[^\s<>"\]]+)/);
    if (urlMatch) {
      result.push({ link: { href: urlMatch[1], content: urlMatch[1] } });
      remaining = remaining.slice(urlMatch[0].length);
      continue;
    }

    // Hashtags: #tag - disabled, chat UI doesn't render them
    // const tagMatch = remaining.match(/^#([a-zA-Z][a-zA-Z0-9_-]*)/);
    // if (tagMatch) {
    //   result.push({ tag: tagMatch[1] });
    //   remaining = remaining.slice(tagMatch[0].length);
    //   continue;
    // }

    // Plain text: consume until next markdown token or URL start.
    // This prevents swallowing the "https" prefix before "://".
    const specialTokenIndices = [
      remaining.indexOf('**'),
      remaining.indexOf('__'),
      remaining.indexOf('~~'),
      remaining.indexOf('`'),
      remaining.indexOf('['),
      remaining.indexOf('!'),
      remaining.indexOf('~'),
      remaining.indexOf('\n'),
      remaining.indexOf('*'),
      remaining.indexOf('_'),
    ].filter((idx) => idx >= 0);

    const urlIndex = remaining.search(/https?:\/\//);
    if (urlIndex >= 0) {
      specialTokenIndices.push(urlIndex);
    }

    const refIndex = remaining.search(REF_PATH_START_REGEX);
    if (refIndex >= 0) {
      specialTokenIndices.push(refIndex);
    }

    const nextTokenIndex =
      specialTokenIndices.length > 0 ? Math.min(...specialTokenIndices) : -1;

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
 * Process inlines and extract image and reference markers into blocks
 */
function processInlinesForBlocks(inlines: StoryInline[]): {
  inlines: StoryInline[];
  blocks: StoryVerse[];
} {
  const cleanInlines: StoryInline[] = [];
  const blocks: StoryVerse[] = [];

  for (const inline of inlines) {
    if (typeof inline === 'object' && '__image' in inline) {
      const img = (
        inline as unknown as { __image: { src: string; alt: string } }
      ).__image;
      blocks.push(createImageBlock(img.src, img.alt));
    } else if (typeof inline === 'object' && '__cite' in inline) {
      const { __cite: cite } = inline as unknown as { __cite: Cite };
      blocks.push({ block: { cite } });
    } else {
      cleanInlines.push(inline);
    }
  }

  return { inlines: cleanInlines, blocks };
}

/**
 * Convert markdown text to Tlon story format
 */
export function markdownToStory(markdown: string): Story {
  const story: Story = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block: ```lang\ncode\n```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
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
      i++; // skip closing ```
      continue;
    }

    // Headers: # H1, ## H2, etc.
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      story.push({
        block: {
          header: {
            tag,
            content: parseInlineMarkdown(headerMatch[2], { allowRefs: false }),
          },
        },
      });
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
      story.push({
        inline: [
          { blockquote: parseInlineMarkdown(quoteText, { allowRefs: false }) },
        ],
      });
      continue;
    }

    // Empty line - skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph - collect consecutive non-empty lines
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^(-{3,}|\*{3,})$/.test(lines[i].trim())
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
