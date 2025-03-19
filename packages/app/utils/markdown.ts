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

// Initialize markdown parser with GFM extensions
try {
  // Try to use marked-gfm-heading-id if available
  marked.use(require('marked-gfm-heading-id'));

  // Configure marked to strictly follow GFM spec
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert '\n' to <br>
    headerIds: false, // Don't add id attributes to headers
    mangle: false, // Don't mangle email addresses
    pedantic: false, // Don't be overly conformant to original markdown
    smartLists: true, // Use smarter list behavior than the original markdown
    smartypants: true, // Use "smart" typographic punctuation
    sanitize: false, // We don't output HTML so no need to sanitize
  });
} catch (e) {
  console.warn('GFM extension loading failed:', e);
}

/**
 * Convert Markdown to a properly structured Story with Verse objects
 * Handles full GitHub Flavored Markdown spec including:
 * - ATX and Setext headings
 * - Lists (ordered, unordered, and task lists)
 * - Block quotes
 * - Code blocks (fenced and indented)
 * - Tables
 * - Inline formatting with proper precedence
 */
export const markdownToStory = (markdown: string): Story => {
  if (!markdown.trim()) {
    return [];
  }

  // Parse the markdown to get tokens
  const tokens = marked.lexer(markdown);
  const story: Verse[] = [];

  /**
   * Processes a string with code spans before any other inline formatting
   * Code spans have higher precedence than any other inline constructs
   * except HTML tags and autolinks
   */
  const parseInlineWithPrecedence = (text: string): Inline[] => {
    // First pass: extract code spans as they have high precedence
    const segments: Inline[] = [];
    const codeSpanRegex = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;

    let match;
    let lastIndex = 0;

    while ((match = codeSpanRegex.exec(text)) !== null) {
      const [fullMatch, backticks, code] = match;
      const beforeText = text.substring(lastIndex, match.index);

      // Process any text before the code span
      if (beforeText) {
        segments.push(...parseOtherInlines(beforeText));
      }

      // Add the code span - code spans have leading/trailing spaces stripped
      // but only if there's a space at both ends and the span isn't all spaces
      let processedCode = code;
      if (
        processedCode.startsWith(' ') &&
        processedCode.endsWith(' ') &&
        processedCode.trim() !== ''
      ) {
        processedCode = processedCode.substring(1, processedCode.length - 1);
      }

      // Remove any escape backslashes before backticks inside code spans
      processedCode = processedCode.replace(/\\`/g, '`');

      // Remove backslashes from other characters in code spans
      processedCode = processedCode.replace(/\\([\\*_{}[\]()#+\-.!])/g, '$1');

      segments.push({
        'inline-code': processedCode,
      });

      lastIndex = match.index + fullMatch.length;
    }

    // Process any remaining text for other inline elements
    const textAfter = text.substring(lastIndex);
    if (textAfter) {
      segments.push(...parseOtherInlines(textAfter));
    }

    return segments.length > 0 ? segments : [text];
  };

  /**
   * Process all other inline elements after code spans are handled
   */
  const parseOtherInlines = (text: string): Inline[] => {
    // Process links next (they have higher precedence than emphasis)
    return processLinks(text);
  };

  /**
   * Process links within text
   */
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

      // For links, we need to process the link text for formatting
      // This allows for links with bold, italic, etc. inside them
      // But we can only use the text version since that's what our types support
      const linkContent = processFormattedText(linkText);
      const formattedText = linkContent
        .map((item) =>
          typeof item === 'string'
            ? item
            : 'bold' in item
              ? `**${item.bold}**`
              : 'italics' in item
                ? `*${item.italics}*`
                : 'strike' in item
                  ? `~~${item.strike}~~`
                  : linkText
        )
        .join('');

      // Add the link with proper formatting inside
      segments.push({
        link: {
          href: linkUrl,
          content: formattedText || linkText,
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

  /**
   * Process text for strikethrough, bold, and italic formatting,
   * respecting GFM precedence rules
   */
  const processFormattedText = (text: string): Inline[] => {
    // Process strikethrough first (GFM feature): ~~text~~
    const strikeRegex = /~~((?:(?!~~).)+)~~/g;
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

  /**
   * Process text for bold and italic formatting
   * Supports both * and _ syntax, with proper nesting
   */
  const processBoldAndItalic = (text: string): Inline[] => {
    // Process bold: **text** or __text__
    // Must not be preceded or followed by alphanumeric or * or _
    const boldRegex = /(\*\*|__)((?:(?!\1).)+)\1/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      const [fullMatch, delimiter, content] = match;
      const beforeText = text.substring(lastIndex, match.index);

      if (beforeText) {
        segments.push(...processItalics(beforeText));
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
      return processItalics(text);
    }

    return segments;
  };

  /**
   * Process text for italic formatting
   * Supports both * and _ syntax
   */
  const processItalics = (text: string): Inline[] => {
    // Look for *text* or _text_ but avoid matching single asterisks in words
    // Preceding character must not be alphanumeric or * or _
    // Following character must not be alphanumeric or * or _
    const italicRegex = /(\*|_)((?:(?!\1).)+)\1/g;
    let match;
    const segments: Inline[] = [];
    let lastIndex = 0;

    while ((match = italicRegex.exec(text)) !== null) {
      const [fullMatch, delimiter, content] = match;
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

  /**
   * Main parser function that processes markdown tokens
   */
  tokens.forEach((token) => {
    if (token.type === 'paragraph') {
      // Convert paragraph text to a VerseInline with proper formatting
      const inlines = parseInlineWithPrecedence(token.text);
      story.push({
        inline: inlines,
      } as Verse);
    } else if (token.type === 'heading') {
      // Create a properly styled heading block
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
      const inlines = parseInlineWithPrecedence(token.text);

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
      // Remove any escape backslashes that may cause display issues
      let cleanedCode = token.text.replace(/\\`/g, '`');

      // Remove backslashes from other escaped characters in code blocks
      cleanedCode = cleanedCode.replace(/\\([\\*_{}[\]()#+\-.!])/g, '$1');

      story.push({
        block: {
          code: {
            code: cleanedCode,
            lang: token.lang || '',
          },
        },
      } as Verse);
    } else if (token.type === 'blockquote') {
      // Handle blockquotes with the proper inline structure
      const inlines = parseInlineWithPrecedence(token.text);
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
      const tableContent = {
        header: token.header.map((cell: any) => String(cell.text || cell)),
        rows: token.rows.map((row: any[]) =>
          row.map((cell: any) => String(cell.text || cell))
        ),
      };

      // Create a proper table block
      story.push({
        block: {
          table: {
            tableContent,
          },
        },
      } as unknown as Verse);
    }
  });

  /**
   * Helper function to process list items including task lists (GFM extension)
   */
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
        const inlines = parseInlineWithPrecedence(item.text);

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
        const inlines = parseInlineWithPrecedence(item.text);

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
      .map(
        (para) =>
          ({
            inline: parseInlineWithPrecedence(para),
          }) as Verse
      );
  }

  return cleanupEmptyParagraphs(story);
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

/**
 * Creates a test story using all GitHub Flavored Markdown features
 * This function can be used to validate that the parser correctly handles
 * all GFM syntax elements according to spec.
 */
export function testGFMFeatures(): { markdown: string; story: Story } {
  const testMarkdown = `# GitHub Flavored Markdown Test

## Headers

# H1 Header
## H2 Header
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header

## Emphasis

*This text is italicized*
_This text is also italicized_

**This text is bold**
__This text is also bold__

**Bold and _nested italic_ text**
***Bold and italic text***
~~Strikethrough text~~

## Lists

### Unordered Lists

* Item 1
* Item 2
  * Nested item 2.1
  * Nested item 2.2
* Item 3

### Ordered Lists

1. Item 1
2. Item 2
   1. Nested item 2.1
   2. Nested item 2.2
3. Item 3

### Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] @mentions, #refs, [links](https://github.com), **formatting**, and ~~tags~~ are supported
- [x] List syntax is required (any unordered or ordered list supported)

## Code

Inline \`code\` has \`back-ticks around\` it.

\`\`\`javascript
// Code block with syntax highlighting
function example() {
  console.log("This is a code block");
}
\`\`\`

## Tables

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1    | Data     | Data     |
| Row 2    | Data     | Data     |

## Blockquotes

> This is a blockquote
> 
> It can span multiple lines
>
> > And can be nested

## Horizontal Rules

---

***

___

## Links

[GitHub](https://github.com)
[Link with **formatting** inside](https://example.com)

## Complex Nesting

* List with **bold text** and *italic text*
  * Nested list with \`inline code\`
    * Deeply nested with [a link](https://example.com)

> Blockquote with **bold**, *italic*, and \`code\`
>
> * List inside blockquote
>   * Nested item

This is a paragraph with **bold text** and *italic text* and \`code\` and [a link](https://example.com) and ~~strikethrough~~.

End of test.`;

  // Parse the markdown and return both the input and output
  return {
    markdown: testMarkdown,
    story: markdownToStory(testMarkdown),
  };
}
