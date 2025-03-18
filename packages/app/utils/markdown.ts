import {
  Block,
  Story,
  Verse,
  constructStory,
} from '@tloncorp/shared/urbit/channel';
import { Inline, JSONContent } from '@tloncorp/shared/urbit/content';
import { marked } from 'marked';

/**
 * This module provides utilities for converting between markdown text and structured message AST.
 *
 * - markdownToStory: Converts markdown text to the Story structure
 * - processContent: Unified API that handles markdown text or structured content
 * - createStoryContent: Like processContent but for simpler input types
 *
 * Example:
 * ```
 * import { processContent } from '@tloncorp/app/utils/markdown';
 *
 * // From markdown text
 * const story = processContent("# Header\nThis is **bold** text");
 *
 * // From structured content
 * const story = processContent(inlineArray, true); // true = code as blocks
 * ```
 */

// Initialize markdown parser
try {
  marked.use(require('marked-gfm-heading-id'));
} catch (e) {
  console.log('Optional GFM extension not loaded', e);
}

/**
 * Convert Markdown to a properly structured Story with Verse objects
 */
export const markdownToStory = (markdown: string): Story => {
  if (!markdown.trim()) {
    return [];
  }

  // Configure marked options
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    pedantic: false,
    smartLists: true,
    smartypants: true,
    sanitize: true,
  });

  // Parse the markdown to get tokens
  const tokens = marked.lexer(markdown);
  const story: Verse[] = [];

  // Helper function to parse inline elements within text
  const parseInline = (text: string): Inline[] => {
    // Process code spans first: `code`
    const codeSpanRegex = /`([^`]+)`/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    while ((match = codeSpanRegex.exec(text)) !== null) {
      const [fullMatch, code] = match;
      const beforeText = text.substring(lastIndex, match.index);

      // Process any text before the code span
      if (beforeText) {
        segments.push(...processLinks(beforeText));
      }

      // Add the code span
      segments.push({
        'inline-code': code,
      });

      lastIndex = match.index + fullMatch.length;
    }

    // Process any remaining text for links and other formatting
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      segments.push(...processLinks(remainingText));
    }

    // If no formatting found, process for links
    if (segments.length === 0) {
      return processLinks(text);
    }

    return segments;
  };

  // Process links within text
  const processLinks = (text: string): Inline[] => {
    // Handle links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    // Process links
    while ((match = linkRegex.exec(text)) !== null) {
      const [fullMatch, linkText, linkUrl] = match;
      const beforeText = text.substring(lastIndex, match.index);

      // Add any text before the link
      if (beforeText) {
        // Process any formatting in the text before the link
        segments.push(...processFormattedText(beforeText));
      }

      // Add the link
      segments.push({
        link: {
          href: linkUrl,
          content: linkText,
        },
      });

      lastIndex = match.index + fullMatch.length;
    }

    // Add any remaining text after the last link
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      // Process any formatting in the remaining text
      segments.push(...processFormattedText(remainingText));
    }

    // If no segments were created, just process the original text for formatting
    if (segments.length === 0) {
      return processFormattedText(text);
    }

    return segments;
  };

  // Helper to process bold and italic formatting in text
  const processFormattedText = (text: string): Inline[] => {
    // Process strikethrough first (GFM feature): ~~text~~
    const strikeRegex = /~~(.*?)~~/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    while ((match = strikeRegex.exec(text)) !== null) {
      const [fullMatch, content] = match;
      const beforeText = text.substring(lastIndex, match.index);

      if (beforeText) {
        segments.push(...processBoldAndItalic(beforeText));
      }

      // Process potential formatting inside the strikethrough text
      const innerContent = processBoldAndItalic(content);
      segments.push({ strike: innerContent });

      lastIndex = match.index + fullMatch.length;
    }

    // Process any remaining text for bold and italic
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      segments.push(...processBoldAndItalic(remainingText));
    }

    // If no formatting found, process for bold and italic
    if (segments.length === 0) {
      return processBoldAndItalic(text);
    }

    return segments;
  };

  // Helper to process bold and italic formatting
  const processBoldAndItalic = (text: string): Inline[] => {
    // Process bold: **text** or __text__
    const boldRegex = /\*\*(.*?)\*\*|__(.*?)__/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      const [fullMatch, content1, content2] = match;
      const content = content1 || content2;
      const beforeText = text.substring(lastIndex, match.index);

      if (beforeText) {
        segments.push(beforeText);
      }

      // Process potential italic formatting inside the bold text
      const innerContent = processItalics(content);
      segments.push({ bold: innerContent });

      lastIndex = match.index + fullMatch.length;
    }

    // Process any remaining text for italics
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      segments.push(...processItalics(remainingText));
    }

    // If no formatting found, return the original text
    if (segments.length === 0) {
      return [text];
    }

    return segments;
  };

  // Helper to process italic formatting
  const processItalics = (text: string): Inline[] => {
    // Look for *text* or _text_ but avoid matching single asterisks in words
    const italicRegex =
      /(\*(?!\*)(.*?[^\\])\*(?!\*))|(_(?!_)(.*?[^\\])_(?!_))/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    while ((match = italicRegex.exec(text)) !== null) {
      const [fullMatch, m1, content1, m3, content2] = match;
      const content = content1 || content2;
      const beforeText = text.substring(lastIndex, match.index);

      if (beforeText) {
        segments.push(beforeText);
      }

      segments.push({ italics: [content] });

      lastIndex = match.index + fullMatch.length;
    }

    // Add any remaining text
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      segments.push(remainingText);
    }

    // If no formatting found, return the original text
    if (segments.length === 0) {
      return [text];
    }

    return segments;
  };

  // Process each token and convert to appropriate Verse structures
  tokens.forEach((token) => {
    if (token.type === 'paragraph') {
      // Convert paragraph text to a VerseInline with proper formatting
      const inlines = parseInline(token.text);
      story.push({
        inline: inlines,
      } as Verse);
    } else if (token.type === 'heading') {
      // Create a properly styled heading block using the Header type from the content model
      // Map the heading depth (1-6) to the corresponding header tag (h1-h6)
      const headingLevels: Record<
        number,
        'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      > = {
        1: 'h1',
        2: 'h2',
        3: 'h3',
        4: 'h4',
        5: 'h5',
        6: 'h6',
      };

      // Parse the heading content with inline formatting
      const inlines = parseInline(token.text);

      // Create a proper heading block
      story.push({
        block: {
          header: {
            tag: headingLevels[token.depth] || 'h1', // Default to h1 if invalid depth
            content: inlines,
          },
        },
      } as Verse);
    } else if (token.type === 'list') {
      // Handle lists - convert each item to its own Verse
      processListItems(token, 0); // Start with indentation level 0
    } else if (token.type === 'code') {
      // Handle code blocks using the proper Code block type
      story.push({
        block: {
          code: {
            code: token.text,
            lang: token.lang || '',
          },
        },
      } as Verse);
    } else if (token.type === 'blockquote') {
      // Handle blockquotes with the proper inline structure
      const inlines = parseInline(token.text);
      story.push({
        inline: [
          {
            blockquote: inlines,
          },
        ],
      } as Verse);
    } else if (token.type === 'hr') {
      // Handle horizontal rules with a simple separator
      story.push({
        block: {
          rule: null,
        },
      } as Verse);
    } else if (token.type === 'space') {
      // Skip empty space tokens - they're just the whitespace between paragraphs
      return;
    } else if (token.type === 'link') {
      // Handle standalone links (not within paragraphs)
      story.push({
        inline: [
          {
            link: {
              href: token.href,
              content: token.text,
            },
          },
        ],
      } as Verse);
    } else if (token.type === 'table') {
      // Handle tables (GFM feature)
      const tableText = renderTableAsText(token);
      story.push({
        inline: [tableText],
      } as Verse);
    }
  });

  // Helper function to render tables as text (since we don't have a native table element in Verse)
  function renderTableAsText(tableToken: any): string {
    if (!tableToken.header || !tableToken.rows) {
      return '';
    }

    let result = '';

    // Render header
    result += '| ' + tableToken.header.join(' | ') + ' |\n';

    // Render separator row
    result += '| ' + tableToken.header.map(() => '---').join(' | ') + ' |\n';

    // Render data rows
    tableToken.rows.forEach((row: string[]) => {
      result += '| ' + row.join(' | ') + ' |\n';
    });

    return result;
  }

  // Helper function to process list items including nested lists
  function processListItems(listToken: any, indentLevel: number) {
    if (!listToken.items || !Array.isArray(listToken.items)) {
      return;
    }

    listToken.items.forEach((item: any, index: number) => {
      // Calculate the proper indentation prefix based on nesting level
      const indentPrefix = '  '.repeat(indentLevel);

      // Handle task lists (GFM feature)
      if (item.task) {
        const checkboxChar = item.checked ? '☑' : '☐';
        const taskPrefix = listToken.ordered
          ? `${indentPrefix}${index + 1}. ${checkboxChar} `
          : `${indentPrefix}• ${checkboxChar} `;

        // Process the item text with inline formatting
        const inlines = parseInline(item.text);

        // Create a verse with the formatted list item
        story.push({
          inline: [taskPrefix, ...inlines],
        } as Verse);
      } else {
        // Regular list item (ordered or unordered)
        const prefix = listToken.ordered
          ? `${indentPrefix}${index + 1}. `
          : `${indentPrefix}• `;

        // Process the item text with inline formatting
        const inlines = parseInline(item.text);

        // Create a verse with the formatted list item
        story.push({
          inline: [prefix, ...inlines],
        } as Verse);
      }

      // Process nested lists if present
      if (item.items && Array.isArray(item.items) && item.items.length > 0) {
        const nestedList = {
          ordered: !!item.ordered,
          items: item.items,
        };

        // Process nested list with increased indentation
        processListItems(nestedList, indentLevel + 1);
      }
    });
  }

  // If we couldn't parse anything properly, fallback to simple paragraph conversion
  if (story.length === 0) {
    const paragraphs = markdown.split(/\n\n+/);
    return paragraphs
      .map((para) => para.trim())
      .filter((para) => para.length > 0) // Filter out empty paragraphs
      .map((para) => ({ inline: [para] }) as Verse);
  }

  return story;
};

/**
 * Cleans up a Story by removing empty paragraphs
 */
function cleanupEmptyParagraphs(story: Story): Story {
  if (!story || !Array.isArray(story) || story.length === 0) {
    return story;
  }

  return story.filter((verse) => {
    // Keep all block verses
    if ('block' in verse) {
      return true;
    }

    // Keep inline verses that have content
    if ('inline' in verse) {
      const inlines = verse.inline;

      // Filter out verses that are just empty strings or whitespace
      if (inlines.length === 0) {
        return false;
      }

      if (
        inlines.length === 1 &&
        typeof inlines[0] === 'string' &&
        inlines[0].trim() === ''
      ) {
        return false;
      }

      return true;
    }

    return true;
  });
}

/**
 * A unified approach that combines Markdown parsing with constructStory functionality
 */
export function createStoryContent(
  input: string | (Inline | Block)[],
  codeAsBlock?: boolean
): Story {
  let result: Story;

  // If input is a string, parse it as markdown
  if (typeof input === 'string') {
    result = markdownToStory(input);
  } else {
    // Otherwise use constructStory to build the structure
    result = constructStory(input, codeAsBlock);
  }

  // Clean up empty paragraphs before returning
  return cleanupEmptyParagraphs(result);
}

/**
 * Unified function to process content to a Story regardless of input type
 */
export function processContent(
  content: string | (Inline | Block)[] | Story,
  codeAsBlock?: boolean
): Story {
  let result: Story;

  // If it's already a Story, return as is
  if (
    Array.isArray(content) &&
    content.length > 0 &&
    typeof content[0] === 'object' &&
    content[0] !== null &&
    ('inline' in content[0] || 'block' in content[0])
  ) {
    result = content as Story;
  }
  // If it's a string, assume markdown
  else if (typeof content === 'string') {
    result = markdownToStory(content);
  }
  // Otherwise, it's an array of Inline/Block elements
  else {
    result = constructStory(content as (Inline | Block)[], codeAsBlock);
  }

  // Clean up empty paragraphs before returning
  return cleanupEmptyParagraphs(result);
}
