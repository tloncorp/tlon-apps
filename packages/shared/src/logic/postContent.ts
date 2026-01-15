import * as api from '../api';
import { ContentReference } from '../domain';
import * as ub from '../urbit';
import { assertNever } from '../utils';
import { PostBlobDataEntry, parsePostBlob } from './content-helpers';
import { VIDEO_REGEX, containsOnlyEmoji } from './utils';

// Inline types

export type StyleInlineData = {
  type: 'style';
  style: 'bold' | 'italic' | 'strikethrough' | 'code';
  children: InlineData[];
};

export type TextInlineData = {
  type: 'text';
  text: string;
};

export type MentionInlineData = {
  type: 'mention';
  contactId: string;
};

export type GroupMentionInlineData = {
  type: 'groupMention';
  group: 'all' | string;
};

export type LineBreakInlineData = {
  type: 'lineBreak';
};

export type LinkInlineData = {
  type: 'link';
  href: string;
  text: string;
};

export type TaskInlineData = {
  type: 'task';
  checked: boolean;
  children: InlineData[];
};

export type InlineData =
  | StyleInlineData
  | TextInlineData
  | MentionInlineData
  | GroupMentionInlineData
  | LineBreakInlineData
  | LinkInlineData
  | TaskInlineData;

export type InlineType = InlineData['type'];

export type InlineFromType<T extends InlineType> = Extract<
  InlineData,
  { type: T }
>;

// Block content types

export type BlockquoteBlockData = {
  type: 'blockquote';
  content: InlineData[];
};

export type ParagraphBlockData = {
  type: 'paragraph';
  content: InlineData[];
};

export type BigEmojiBlockData = {
  type: 'bigEmoji';
  emoji: string;
};

export type ImageBlockData = {
  type: 'image';
  src: string;
  height: number;
  width: number;
  alt: string;
};

export type VideoBlockData = {
  type: 'video';
  src: string;
  height: number;
  width: number;
  alt: string;
};

export type FileUploadBlockData = {
  type: 'file';
  file: PostBlobDataEntry;
};

export type LinkBlockData = {
  type: 'link';
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  siteIconUrl?: string;
  previewImageUrl?: string;
  previewImageWidth?: string;
  previewImageHeight?: string;
};

export type ReferenceBlockData = ContentReference;

export type CodeBlockData = {
  type: 'code';
  content: string;
  lang?: string;
};

export type HeaderBlockData = {
  type: 'header';
  level: ub.HeaderLevel;
  children: InlineData[];
};

export type RuleBlockData = {
  type: 'rule';
};

export type ListBlockData = {
  type: 'list';
  list: ListData;
};

export type ListData = {
  content: InlineData[];
  type?: 'ordered' | 'unordered' | 'tasklist';
  children?: ListData[];
};

export type BlockData =
  | BlockquoteBlockData
  | ParagraphBlockData
  | ImageBlockData
  | VideoBlockData
  | FileUploadBlockData
  | LinkBlockData
  | ReferenceBlockData
  | CodeBlockData
  | HeaderBlockData
  | RuleBlockData
  | ListBlockData
  | BigEmojiBlockData;

export type BlockType = BlockData['type'];

export type BlockFromType<T extends BlockType> = Extract<
  BlockData,
  { type: T }
>;

export type PostContent = BlockData[];

export interface PlaintextPreviewConfig {
  blockSeparator: string;
  includeLinebreaks: boolean;
  includeRefTag: boolean;
  indentDepth?: number;
}
export namespace PlaintextPreviewConfig {
  export const defaultConfig: PlaintextPreviewConfig = Object.freeze({
    blockSeparator: '\n',
    includeLinebreaks: true,
    includeRefTag: true,
  });

  export const inlineConfig: PlaintextPreviewConfig = Object.freeze({
    blockSeparator: ' ',
    includeLinebreaks: false,
    includeRefTag: false,
  });
}

export function plaintextPreviewOf(
  content: PostContent,
  config: PlaintextPreviewConfig = PlaintextPreviewConfig.defaultConfig
): string {
  return content
    .map((block) => {
      switch (block.type) {
        case 'blockquote':
          return `> ${plaintextPreviewOfInlineString(block.content, config)}`;
        case 'paragraph':
          return plaintextPreviewOfInlineString(block.content, config);
        case 'image':
          return '(Image)';
        case 'video':
          return '(Video)';
        case 'reference':
          return config.includeRefTag ? '(Ref)' : '';
        case 'code':
          return `\`\`\`${block.lang ?? ''}\n${block.content}\n\`\`\``;
        case 'header':
          return plaintextPreviewOfInlineString(block.children, config);
        case 'rule':
          return '---';
        case 'list':
          return plaintextPreviewOfListData(block.list, config);
        case 'bigEmoji':
          return block.emoji;
      }
    })
    .join(config.blockSeparator)
    .trim();
}

function plaintextPreviewOfListData(
  list: ListData,
  config: PlaintextPreviewConfig
): string {
  const out: string[] = [];
  out.push(plaintextPreviewOfInlineString(list.content, config));
  if (list.children != null) {
    const delimiter = (index: number) => {
      switch (list.type) {
        case undefined:
        // fallthrough
        case 'tasklist':
        // fallthrough
        case 'unordered':
          return '-';
        case 'ordered':
          return `${index + 1}.`;
      }
    };
    const currentIndentDepth = config.indentDepth ?? 0;
    const effectiveIndentDepth = config.includeLinebreaks
      ? currentIndentDepth
      : 0;
    out.push(
      ...list.children.map(
        (child, index) =>
          `${'\t'.repeat(effectiveIndentDepth)}${delimiter(index)} ${plaintextPreviewOfListData(
            child,
            {
              ...config,
              indentDepth: currentIndentDepth + 1,
            }
          )}`
      )
    );
  }
  return out.join(config.blockSeparator);
}

export function plaintextPreviewOfInlineString(
  inlines: InlineData[],
  config: PlaintextPreviewConfig
): string {
  return inlines
    .map((inline) => plaintextPreviewOfInline(inline, config))
    .join('');
}
export function plaintextPreviewOfInline(
  inline: InlineData,
  config: PlaintextPreviewConfig
): string {
  switch (inline.type) {
    case 'style':
      return plaintextPreviewOfInlineString(inline.children, config);
    case 'text':
      return inline.text;
    case 'mention':
      return inline.contactId;
    case 'groupMention':
      return `@${inline.group}`;
    case 'lineBreak':
      return '\n';
    case 'link':
      return inline.text;
    case 'task': {
      let out = inline.checked ? '[x] ' : '[ ] ';
      out += plaintextPreviewOfInlineString(inline.children, config);
      return out;
    }
  }
}

/**
 * Preprocess content for rendering. Alterations include:
 * - Removing line breaks at end of content
 * - Identifying and extract block-like inlines to the top level (block quotes,
 *   code blocks, etc.)
 * - Simplifying data structure so that we can easily switch on type while
 *   rendering.
 *
 * I don't love that this happens each time a post is rendered -- I'd like to
 * move to something like this for all local content representation, only
 * converting it to the current format for interaction with the api.
 *
 * The format is very loosely inspired by ProseMirror's internal representation,
 * and could be converted to be compatible pretty easily.
 */
export function convertContent(
  input: unknown,
  blob: string | undefined | null
): PostContent {
  const out: PostContent = [];

  if (blob != null) {
    const blobData = parsePostBlob(blob);
    for (const entry of blobData) {
      switch (entry.type) {
        case 'file': {
          out.push({
            type: 'file',
            file: entry,
          });
          break;
        }

        case 'unknown': {
          out.push({
            type: 'blockquote',
            content: [
              { type: 'text', text: 'Upgrade your app to see this post' },
            ],
          });
          break;
        }
      }
    }
  }

  if (!input) {
    return out;
  }

  const story: api.PostContent =
    typeof input === 'string' ? JSON.parse(input) : input;

  if (!story) {
    return out;
  }

  out.push(...convertContentSafe(story));
  return out;
}

/**
 * Same as `convertContent`, but does not parse the input, and
 * applies more type strictness at callsite.
 */
export function convertContentSafe(
  story: Exclude<api.PostContent, null>
): PostContent {
  const blocks: PostContent = [];
  for (const verse of story) {
    if ('type' in verse && verse.type === 'reference') {
      blocks.push(verse);
    } else if ('block' in verse) {
      const convertedBlock = convertBlock(verse.block);
      blocks.push(convertedBlock);
    } else if ('inline' in verse) {
      blocks.push(...convertTopLevelInline(verse));
    } else {
      console.warn('Unhandled verse type:', { verse });
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Unknown content type' }],
      });
    }
  }

  return blocks;
}

/**
 * Convert an array of inlines to an array of blocks. The existing inline will
 * be split if it contains block-like inlines (again, blockquote, code block,
 * etc.)
 */

function convertTopLevelInline(verse: ub.VerseInline): BlockData[] {
  const blocks: BlockData[] = [];
  let currentInlines: ub.Inline[] = [];

  function flushCurrentBlock() {
    if (currentInlines.length) {
      const isOnlyWhitespace = currentInlines.every(
        (item) => typeof item === 'string' && (item as string).trim() === ''
      );

      if (!isOnlyWhitespace) {
        const convertedInlines = convertInlineContent(currentInlines);
        if (convertedInlines.length) {
          blocks.push({
            type: 'paragraph',
            content: convertedInlines,
          });
        }
      }
      currentInlines = [];
    }
  }

  if (
    // Start with cheaper checks to rule out most cases
    verse.inline.length < 3 &&
    (!verse.inline[1] || ub.isBreak(verse.inline[1])) &&
    typeof verse.inline[0] === 'string' &&
    verse.inline[0].length < 12 &&
    containsOnlyEmoji(verse.inline[0].trim())
  ) {
    return [
      {
        type: 'bigEmoji',
        emoji: verse.inline[0],
      },
    ];
  }

  verse.inline.forEach((inline) => {
    if (ub.isBlockquote(inline)) {
      flushCurrentBlock();
      blocks.push({
        type: 'blockquote',
        content: convertInlineContent(inline.blockquote),
      });
    } else if (ub.isBlockCode(inline)) {
      flushCurrentBlock();
      blocks.push({
        type: 'code',
        content: inline.code,
      });
    } else {
      currentInlines.push(inline);
    }
  });
  flushCurrentBlock();
  return blocks;
}

function convertBlock(block: ub.Block): BlockData {
  const is = ub.Block.is;
  const errorMessage = (text: string): BlockData => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  });

  switch (true) {
    case is(block, 'image'): {
      if (VIDEO_REGEX.test(block.image.src)) {
        return {
          type: 'video',
          ...block.image,
        };
      } else {
        return {
          type: 'image',
          ...block.image,
        };
      }
    }

    case is(block, 'listing'): {
      return {
        type: 'list',
        list: convertListing(block.listing),
      };
    }
    case is(block, 'header'): {
      return {
        type: 'header',
        level: block.header.tag,
        children: convertInlineContent(block.header.content),
      };
    }
    case is(block, 'code'): {
      return {
        type: 'code',
        content: block.code.code,
        lang: block.code.lang,
      };
    }
    case is(block, 'rule'): {
      return {
        type: 'rule',
      };
    }
    case is(block, 'cite'): {
      return (
        api.toContentReference(block.cite) ?? errorMessage('Failed to parse')
      );
    }
    case is(block, 'link'): {
      return {
        ...block.link.meta,
        type: 'link',
        url: block.link.url,
      };
    }
    default: {
      assertNever(block);

      console.warn('Unhandled block type:', { block });
      return errorMessage('Unknown content type');
    }
  }
}

function convertListing(listing: ub.Listing): ListData {
  if (ub.isList(listing)) {
    return {
      type: listing.list.type,
      content: convertInlineContent(listing.list.contents),
      children: listing.list.items.map(convertListing),
    };
  } else {
    return {
      content: convertInlineContent(listing.item),
    };
  }
}

function convertInlineContent(inlines: ub.Inline[]): InlineData[] {
  const nodes: InlineData[] = [];
  inlines.forEach((inline, i) => {
    if (typeof inline === 'string') {
      nodes.push({
        type: 'text',
        text: inline,
      });
    } else if (ub.isBold(inline)) {
      nodes.push({
        type: 'style',
        style: 'bold',
        children: convertInlineContent(inline.bold),
      });
    } else if (ub.isItalics(inline)) {
      nodes.push({
        type: 'style',
        style: 'italic',
        children: convertInlineContent(inline.italics),
      });
    } else if (ub.isStrikethrough(inline)) {
      nodes.push({
        type: 'style',
        style: 'strikethrough',
        children: convertInlineContent(inline.strike),
      });
    } else if (ub.isInlineCode(inline)) {
      nodes.push({
        type: 'style',
        style: 'code',
        children: [{ type: 'text', text: inline['inline-code'] }],
      });
    } else if (ub.isLink(inline)) {
      nodes.push({
        type: 'link',
        href: inline.link.href,
        text: inline.link.content ?? inline.link.href,
      });
    } else if (ub.isBreak(inline)) {
      // Most content has a final line break after it -- we don't want to render it.
      if (i !== inlines.length - 1) {
        nodes.push({
          type: 'lineBreak',
        });
      }
    } else if (ub.isShip(inline)) {
      nodes.push({
        type: 'mention',
        contactId: inline.ship,
      });
    } else if (ub.isSect(inline)) {
      nodes.push({
        type: 'groupMention',
        group: !inline.sect ? 'all' : inline.sect,
      });
    } else if (ub.isTask(inline)) {
      nodes.push({
        type: 'task',
        checked: inline.task.checked,
        children: convertInlineContent(inline.task.content),
      });
    } else {
      console.warn('Unhandled inline type:', { inline });
      nodes.push({
        type: 'text',
        text: 'Unknown content type',
      });
    }
  });
  return nodes;
}

export function prependInline(
  content: BlockData[],
  inline: InlineData
): BlockData[] {
  if (content[0]?.type === 'paragraph') {
    return [
      {
        ...content[0],
        content: [inline, ...content[0].content],
      },
      ...content.slice(1),
    ];
  } else {
    return [
      {
        type: 'paragraph',
        content: [inline],
      },
      ...content,
    ];
  }
}

export function appendInline(
  content: BlockData[],
  inline: InlineData
): BlockData[] {
  const lastBlock = content.at(-1);
  if (lastBlock?.type === 'paragraph') {
    return [
      ...content.slice(0, -1),
      {
        ...lastBlock,
        content: [...lastBlock.content, inline],
      },
    ];
  } else {
    return [
      ...content,
      {
        type: 'paragraph',
        content: [inline],
      },
    ];
  }
}

export function getTextContent(
  postContent: Exclude<api.PostContent, null>,
  config?: PlaintextPreviewConfig
): string;
export function getTextContent(
  postContent: api.PostContent,
  config?: PlaintextPreviewConfig
): string | null;
export function getTextContent(
  postContent: api.PostContent,
  config: PlaintextPreviewConfig = PlaintextPreviewConfig.defaultConfig
): string | null {
  return postContent == null
    ? null
    : plaintextPreviewOf(convertContentSafe(postContent), config);
}
