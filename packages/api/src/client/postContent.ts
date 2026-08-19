import type { A2UI } from '../client/a2ui';
import { formatUd } from '../client/apiUtils';
import {
  PostBlobDataEntryFile,
  PostBlobDataEntryVideo,
  PostBlobDataEntryVoiceMemo,
  parsePostBlob,
} from '../client/content-helpers';
import { assertNever } from '../lib/assertNever';
import { VIDEO_REGEX, containsOnlyEmoji } from '../lib/utils';
import type { ContentReference } from '../types/references';
import * as ub from '../urbit';
import { extractTablesFromContent } from './markdown/extractTables';
import { convertInlineContent } from './postContentInlines';
import type { PostContent as ApiPostContent } from './postsApi';

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

export type BlockquoteInlineData = {
  type: 'blockquote';
  children: InlineData[];
};

export type InlineData =
  | StyleInlineData
  | TextInlineData
  | MentionInlineData
  | GroupMentionInlineData
  | LineBreakInlineData
  | LinkInlineData
  | TaskInlineData
  | BlockquoteInlineData;

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

export type VideoContentData = Pick<
  PostBlobDataEntryVideo,
  'duration' | 'posterUri'
> & {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type VideoBlockData = {
  type: 'video';
  video: VideoContentData;
};

export type FileUploadBlockData = {
  type: 'file';
  file: PostBlobDataEntryFile;
};

export type VoiceMemoBlockData = {
  type: 'voicememo';
  voiceMemo: PostBlobDataEntryVoiceMemo;
};

export type A2UIBlockData = {
  type: 'a2ui';
  a2ui: A2UI.BlobEntry;
};

export type KitCardBlockData = {
  type: 'kit-card';
  kit: {
    id: string;
    publisher: string;
    version: string;
    name: string;
    description: string;
    image?: string | null;
  };
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

export type TableAlignment = 'left' | 'center' | 'right';

export type TableCellData = {
  content: InlineData[];
};

export type TableRowData = {
  cells: TableCellData[];
};

export type TableBlockData = {
  type: 'table';
  header: TableRowData;
  rows: TableRowData[];
  align: (TableAlignment | null)[];
};

export type BlockData =
  | BlockquoteBlockData
  | ParagraphBlockData
  | ImageBlockData
  | A2UIBlockData
  | KitCardBlockData
  | VideoBlockData
  | FileUploadBlockData
  | VoiceMemoBlockData
  | LinkBlockData
  | ReferenceBlockData
  | CodeBlockData
  | HeaderBlockData
  | RuleBlockData
  | ListBlockData
  | BigEmojiBlockData
  | TableBlockData;

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

function toContentReference(cite: ub.Cite): ContentReference | null {
  if ('chan' in cite) {
    const channelId = cite.chan.nest;
    // notes channels cite individual notes as /note/<id>, where the id
    // may be dot-grouped urbit-style (1.234)
    if (channelId.startsWith('notes/')) {
      const noteMatch = cite.chan.where.match(/^\/note\/(\d[\d.]*)/);
      if (!noteMatch) {
        return null;
      }
      return {
        type: 'reference',
        referenceType: 'note',
        channelId,
        noteId: noteMatch[1].replace(/\./g, ''),
      };
    }
    // I've seen these forms of reference path:
    // /msg/170141184506828851385935487131294105600
    // /msg/170141184506312077223314290444316180480/170141184506312235291442423303751335936
    // /msg/~sogrum-savluc/170.141.184.505.979.681.243.072.382.329.337.971.474
    const messageIdRegex = /\/([0-9\.]+(?=[$\/]?))/g;
    const [postId, replyId] = Array.from(
      cite.chan.where.matchAll(messageIdRegex)
    ).map((m) => m[1].replace(/\./g, ''));
    if (!postId) {
      return null;
    }
    return {
      type: 'reference',
      referenceType: 'channel',
      channelId,
      postId: formatUd(postId),
      replyId: replyId ? formatUd(replyId) : undefined,
    };
  } else if ('group' in cite) {
    return { type: 'reference', referenceType: 'group', groupId: cite.group };
  } else if ('desk' in cite) {
    const parts = cite.desk.flag.split('/');
    const userId = parts[0];
    const appId = parts[1];
    if (!userId || !appId) {
      return null;
    }
    return { type: 'reference', referenceType: 'app', userId, appId };
  }
  return null;
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
        case 'kit-card':
          return '(Kit)';
        case 'table': {
          const headerText = block.header.cells
            .map((cell) => plaintextPreviewOfInlineString(cell.content, config))
            .filter((text) => text.length > 0)
            .join(' | ');
          return headerText || '(Table)';
        }
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

// Whether an inline's serialized text begins/ends at a quote boundary. `style`
// and `task` flatten their children into the surrounding string, so a quote at
// a wrapper's edge is adjacent in the *output* even though it is not an
// adjacent sibling in the tree. `task` emits its `[x] ` marker first, so it can
// never start with a quote.
//
// These walk the literal edge child, not the first child that actually renders
// anything, so a zero-output sibling (an empty style, an empty text) masks the
// boundary behind it and the separator is skipped. Reaching that needs an empty
// wrapper adjacent to a quote inside another wrapper — no Markdown or editor
// path produces it — so it is left alone rather than pushing edge-walking
// through empty nodes.
function opensWithQuote(inline: InlineData): boolean {
  if (inline.type === 'blockquote') return true;
  if (inline.type === 'style') {
    const first = inline.children[0];
    return first != null && opensWithQuote(first);
  }
  return false;
}

function closesWithQuote(inline: InlineData): boolean {
  if (inline.type === 'blockquote') return true;
  if (inline.type === 'style' || inline.type === 'task') {
    const last = inline.children.at(-1);
    return last != null && closesWithQuote(last);
  }
  return false;
}

// A leading line break supplies its own delimiter, through wrappers too.
function opensWithBreak(inline: InlineData): boolean {
  if (inline.type === 'lineBreak') return true;
  if (inline.type === 'style') {
    const first = inline.children[0];
    return first != null && opensWithBreak(first);
  }
  return false;
}

export function plaintextPreviewOfInlineString(
  inlines: InlineData[],
  config: PlaintextPreviewConfig
): string {
  let out = '';
  inlines.forEach((inline, i) => {
    // A quote boundary that is already delimited does not get another
    // delimiter: skip the separator when the output already ends in a
    // separator or newline, or when this inline opens with its own break.
    const previous = i > 0 ? inlines[i - 1] : null;
    const isQuoteBoundary =
      opensWithQuote(inline) || (previous != null && closesWithQuote(previous));
    if (
      isQuoteBoundary &&
      !opensWithBreak(inline) &&
      out.length > 0 &&
      !out.endsWith(config.blockSeparator) &&
      !out.endsWith('\n')
    ) {
      out += config.blockSeparator;
    }
    out += plaintextPreviewOfInline(inline, config);
  });
  return out;
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
    case 'blockquote':
      return `> ${plaintextPreviewOfInlineString(inline.children, config)}`;
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

        case 'voicememo': {
          out.push({
            type: 'voicememo',
            voiceMemo: entry,
          });
          break;
        }

        case 'video': {
          out.push({
            type: 'video',
            video: {
              src: entry.fileUri,
              alt: entry.name ?? 'video',
              width: entry.width ?? 1,
              height: entry.height ?? 1,
              duration: entry.duration,
              posterUri: entry.posterUri,
            },
          });
          break;
        }

        case 'a2ui': {
          out.push({
            type: 'a2ui',
            a2ui: entry,
          });
          break;
        }

        case 'kit': {
          out.push({
            type: 'kit-card',
            kit: {
              id: entry.id,
              publisher: entry.publisher,
              version: entry.kitVersion,
              name: entry.name,
              description: entry.description,
              image: entry.image,
            },
          });
          break;
        }

        case 'tlon-context-lens': {
          break;
        }

        // Data-only entries. The card a surface describes is rendered by the
        // sibling `a2ui` entry on the same post, and an action is a record of
        // a tap rather than something to display, so neither produces a block.
        case 'interactive-surface':
        case 'interactive-action': {
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

  const story: ApiPostContent =
    typeof input === 'string' ? JSON.parse(input) : input;

  if (!story) {
    return out;
  }

  out.push(...convertContentSafe(story));
  return extractTablesFromContent(out);
}

/**
 * Same as `convertContent`, but does not parse the input, and
 * applies more type strictness at callsite.
 */
export function convertContentSafe(
  story: Exclude<ApiPostContent, null>
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
          video: {
            src: block.image.src,
            alt: block.image.alt,
            width: block.image.width,
            height: block.image.height,
          },
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
      return toContentReference(block.cite) ?? errorMessage('Failed to parse');
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

// Re-exported (and used internally) — definition lives in postContentInlines
// so that markdown/extractTables can import it without going through
// postContent (which would create a cycle).
export { convertInlineContent };

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
  postContent: Exclude<ApiPostContent, null>,
  config?: PlaintextPreviewConfig
): string;
export function getTextContent(
  postContent: ApiPostContent,
  config?: PlaintextPreviewConfig
): string | null;
export function getTextContent(
  postContent: ApiPostContent,
  config: PlaintextPreviewConfig = PlaintextPreviewConfig.defaultConfig
): string | null {
  return postContent == null
    ? null
    : plaintextPreviewOf(convertContentSafe(postContent), config);
}
