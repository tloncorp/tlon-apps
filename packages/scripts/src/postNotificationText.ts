import type { ContentReference } from '@tloncorp/api/types/references';
import type { Verse } from '@tloncorp/api/urbit/channel';
import type { Block, Inline, Listing } from '@tloncorp/api/urbit/content';
import {
  isBlockCode,
  isBlockLink,
  isBlockquote,
  isBold,
  isBreak,
  isCite,
  isCode,
  isHeader,
  isImage,
  isInlineCode,
  isItalics,
  isLink,
  isList,
  isSect,
  isShip,
  isStrikethrough,
  isTask,
} from '@tloncorp/api/urbit/content';

// This module is bundled into native notification rendering, which runs without
// a DOM. Keep it intentionally dependency-light and avoid importing the richer
// API postContent serializers or markdown/table parsing helpers here.
export type PostNotificationTextContent = (Verse | ContentReference)[] | null;

export interface PostNotificationTextConfig {
  blockSeparator: string;
  includeLinebreaks: boolean;
  includeRefTag: boolean;
  indentDepth?: number;
}

export namespace PostNotificationTextConfig {
  export const defaultConfig: PostNotificationTextConfig = Object.freeze({
    blockSeparator: '\n',
    includeLinebreaks: true,
    includeRefTag: true,
  });

  export const inlineConfig: PostNotificationTextConfig = Object.freeze({
    blockSeparator: ' ',
    includeLinebreaks: false,
    includeRefTag: false,
  });
}

const VIDEO_REGEX = /(\.mov|\.mp4|\.ogv|\.webm)(?:\?.*)?$/i;

function previewInlineString(
  inlines: Inline[],
  config: PostNotificationTextConfig
): string {
  return inlines
    .map((inline, index) =>
      previewInline(inline, index, inlines.length, config)
    )
    .join('');
}

function previewInline(
  inline: Inline,
  index: number,
  total: number,
  config: PostNotificationTextConfig
): string {
  if (typeof inline === 'string') {
    return inline;
  }

  if (isBold(inline)) {
    return previewInlineString(inline.bold, config);
  }
  if (isItalics(inline)) {
    return previewInlineString(inline.italics, config);
  }
  if (isStrikethrough(inline)) {
    return previewInlineString(inline.strike, config);
  }
  if (isInlineCode(inline)) {
    return inline['inline-code'];
  }
  if (isLink(inline)) {
    return inline.link.content ?? inline.link.href;
  }
  if (isBreak(inline)) {
    return index === total - 1 ? '' : '\n';
  }
  if (isShip(inline)) {
    return inline.ship;
  }
  if (isSect(inline)) {
    return `@${inline.sect ?? 'all'}`;
  }
  if (isTask(inline)) {
    const prefix = inline.task.checked ? '[x] ' : '[ ] ';
    return `${prefix}${previewInlineString(inline.task.content, config)}`;
  }
  if (isBlockquote(inline)) {
    return `> ${previewInlineString(inline.blockquote, config)}`;
  }
  if (isBlockCode(inline)) {
    return `\`\`\`\n${inline.code}\n\`\`\``;
  }

  return 'Unknown content type';
}

function previewListing(
  listing: Listing,
  config: PostNotificationTextConfig
): string {
  if (isList(listing)) {
    const out: string[] = [];
    out.push(previewInlineString(listing.list.contents, config));

    const currentIndentDepth = config.indentDepth ?? 0;
    const effectiveIndentDepth = config.includeLinebreaks
      ? currentIndentDepth
      : 0;
    const delimiter = (index: number) => {
      switch (listing.list.type) {
        case 'tasklist':
        case 'unordered':
          return '-';
        case 'ordered':
          return `${index + 1}.`;
      }
    };

    out.push(
      ...listing.list.items.map(
        (child, index) =>
          `${'\t'.repeat(effectiveIndentDepth)}${delimiter(index)} ${previewListing(
            child,
            {
              ...config,
              indentDepth: currentIndentDepth + 1,
            }
          )}`
      )
    );
    return out.join(config.blockSeparator);
  }

  return previewInlineString(listing.item, config);
}

function previewBlock(
  block: Block,
  config: PostNotificationTextConfig
): string {
  if (isImage(block)) {
    return VIDEO_REGEX.test(block.image.src) ? '(Video)' : '(Image)';
  }
  if (isHeader(block)) {
    return previewInlineString(block.header.content, config);
  }
  if (isCode(block)) {
    return `\`\`\`${block.code.lang ?? ''}\n${block.code.code}\n\`\`\``;
  }
  if (isCite(block)) {
    return config.includeRefTag ? '(Ref)' : '';
  }
  if (isBlockLink(block)) {
    return '';
  }
  if ('listing' in block) {
    return previewListing(block.listing, config);
  }
  if ('rule' in block) {
    return '---';
  }

  return 'Unknown content type';
}

function previewInlineVerse(
  inlines: Inline[],
  config: PostNotificationTextConfig
): string[] {
  const out: string[] = [];
  let current: Inline[] = [];

  function flushCurrent() {
    if (current.length === 0) {
      return;
    }
    if (
      !current.every(
        (inline) => typeof inline === 'string' && inline.trim() === ''
      )
    ) {
      out.push(previewInlineString(current, config));
    }
    current = [];
  }

  for (const inline of inlines) {
    if (isBlockquote(inline) || isBlockCode(inline)) {
      flushCurrent();
      out.push(previewInline(inline, 0, 1, config));
    } else {
      current.push(inline);
    }
  }
  flushCurrent();

  return out;
}

function isContentReference(
  verse: Verse | ContentReference
): verse is ContentReference {
  return 'type' in verse && verse.type === 'reference';
}

function previewPostNotificationContent(
  postContent: Exclude<PostNotificationTextContent, null>,
  config: PostNotificationTextConfig = PostNotificationTextConfig.defaultConfig
): string {
  return postContent
    .flatMap((verse) => {
      if (isContentReference(verse)) {
        return config.includeRefTag ? ['(Ref)'] : [];
      }
      if ('block' in verse) {
        return [previewBlock(verse.block, config)];
      }
      if ('inline' in verse) {
        return previewInlineVerse(verse.inline, config);
      }
      return ['Unknown content type'];
    })
    .join(config.blockSeparator)
    .trim();
}

export function getPostNotificationText(
  postContent: Exclude<PostNotificationTextContent, null>,
  config?: PostNotificationTextConfig
): string;
export function getPostNotificationText(
  postContent: PostNotificationTextContent,
  config?: PostNotificationTextConfig
): string | null;
export function getPostNotificationText(
  postContent: PostNotificationTextContent,
  config: PostNotificationTextConfig = PostNotificationTextConfig.defaultConfig
): string | null {
  return postContent == null
    ? null
    : previewPostNotificationContent(postContent, config);
}
