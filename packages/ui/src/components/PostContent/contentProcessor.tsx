import { utils } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/dist/api';
import * as ub from '@tloncorp/shared/dist/urbit';

// Inline types

export type InlineStyleNode = {
  type: 'style';
  style: 'bold' | 'italic' | 'strikethrough' | 'code';
  children: InlineNode[];
};

export type InlineTextNode = {
  type: 'text';
  text: string;
};

export type InlineMentionNode = {
  type: 'mention';
  contactId: string;
};

export type InlineLineBreakNode = {
  type: 'lineBreak';
};

export type InlineLinkNode = {
  type: 'link';
  href: string;
  text: string;
};

export type InlineNode =
  | InlineStyleNode
  | InlineTextNode
  | InlineMentionNode
  | InlineLineBreakNode
  | InlineLinkNode;

// Block content types

export type BlockquoteBlock = {
  type: 'blockquote';
  content: InlineNode[];
};

export type ParagraphBlock = {
  type: 'paragraph';
  content: InlineNode[];
};

export type BigEmojiBlock = {
  type: 'bigEmoji';
  emoji: string;
};

export type ImageBlock = {
  type: 'image';
  src: string;
  height: number;
  width: number;
  alt: string;
};

export type VideoBlock = {
  type: 'video';
  src: string;
  height: number;
  width: number;
  alt: string;
};

export type EmbedBlock = {
  type: 'embed';
};

export type ReferenceBlock = api.ContentReference;

export type CodeBlock = {
  type: 'code';
  content: string;
  lang?: string;
};

export type HeaderBlock = {
  type: 'header';
  level: ub.HeaderLevel;
  children: InlineNode[];
};

export type RuleBlock = {
  type: 'rule';
};

export type ListBlock = {
  type: 'list';
  list: ListNode;
};

export type ListNode = {
  content: InlineNode[];
  type?: 'ordered' | 'unordered' | 'tasklist';
  children?: ListNode[];
};

export type Block =
  | BlockquoteBlock
  | ParagraphBlock
  | ImageBlock
  | VideoBlock
  | EmbedBlock
  | ReferenceBlock
  | CodeBlock
  | HeaderBlock
  | RuleBlock
  | ListBlock
  | BigEmojiBlock;

export type PostContent = Block[];

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
  story: NonNullable<api.PostContent>
): PostContent {
  const blocks: PostContent = [];

  for (const verse of story) {
    if ('type' in verse && verse.type === 'reference') {
      blocks.push(verse);
    } else if ('block' in verse) {
      blocks.push(convertBlock(verse.block));
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
function convertTopLevelInline(verse: ub.VerseInline): Block[] {
  const blocks: Block[] = [];
  let currentInlines: ub.Inline[] = [];

  function flushCurrentBlock() {
    if (currentInlines.length) {
      const convertedInlines = convertInlineContent(currentInlines);
      if (convertedInlines.length) {
        blocks.push({
          type: 'paragraph',
          content: convertedInlines,
        });
      }
      currentInlines = [];
    }
  }

  if (
    verse.inline.length === 1 &&
    typeof verse.inline[0] === 'string' &&
    verse.inline.length < 8 &&
    utils.containsOnlyEmoji(verse.inline[0])
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

function convertBlock(block: ub.Block): Block {
  if (ub.isImage(block)) {
    if (utils.VIDEO_REGEX.test(block.image.src)) {
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
  } else if (ub.isListing(block)) {
    return {
      type: 'list',
      list: convertListing(block.listing),
    };
  } else if (ub.isHeader(block)) {
    return {
      type: 'header',
      level: block.header.tag,
      children: convertInlineContent(block.header.content),
    };
  } else if (ub.isCode(block)) {
    return {
      type: 'code',
      content: block.code.code,
      lang: block.code.lang,
    };
  } else if ('rule' in block) {
    return {
      type: 'rule',
    };
  } else {
    console.warn('Unhandled block type:', { block });
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Unknown content type' }],
    };
  }
}

function convertListing(listing: ub.Listing): ListNode {
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

export function convertInlineContent(inlines: ub.Inline[]): InlineNode[] {
  const nodes: InlineNode[] = [];
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
