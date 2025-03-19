import {
  Block,
  ListItem,
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

// Process tokens from the marked lexer and convert to our Story structure
const processTokens = (
  tokens: marked.TokensList | marked.Token[],
  depth: number = 0
): Verse[] => {
  const verses: Verse[] = [];
  const MAX_PROCESSING_DEPTH = 10; // Prevent deep recursion

  // Safety check for maximum recursion depth
  if (depth >= MAX_PROCESSING_DEPTH) {
    console.warn('Maximum token processing depth reached');
    return [
      {
        inline: ['[Content too deeply nested to display]'],
      } as Verse,
    ];
  }

  for (const token of tokens) {
    if (token.type === 'paragraph') {
      // Process paragraph by converting its tokens to inline content
      verses.push({
        inline: processInlineTokens(token.tokens || [], depth + 1),
      } as Verse);
    } else if (token.type === 'heading') {
      // Create a heading block
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

      verses.push({
        block: {
          header: {
            tag: headingLevels[token.depth] || 'h1',
            content: processInlineTokens(token.tokens || [], depth + 1),
          },
        },
      } as Verse);
    } else if (token.type === 'code') {
      // Handle code blocks
      verses.push({
        block: {
          code: {
            code: token.text,
            lang: token.lang || '',
          },
        },
      } as Verse);
    } else if (token.type === 'blockquote') {
      // Handle blockquotes
      // When there's a blockquote token, process all its tokens recursively
      // This ensures we capture nested blockquotes and other content
      verses.push({
        inline: [
          {
            blockquote: processInlineTokens(
              'tokens' in token && Array.isArray(token.tokens)
                ? processNestedBlockquoteTokens(token.tokens, depth + 1)
                : [],
              depth + 1
            ),
          },
        ],
      } as Verse);
    } else if (token.type === 'hr') {
      // Handle horizontal rules
      verses.push({
        block: {
          rule: null,
        },
      } as Verse);
    } else if (token.type === 'list') {
      // Process lists
      verses.push(...processListItems(token, depth + 1));
    } else if (token.type === 'table') {
      // Handle tables
      const tableContent = {
        header: token.header.map((cell: any) => String(cell.text || cell)),
        rows: token.rows.map((row: any[]) =>
          row.map((cell: any) => String(cell.text || cell))
        ),
      };

      verses.push({
        block: {
          table: {
            tableContent,
          },
        },
      } as unknown as Verse);
    }
    // Skip space tokens and other non-content tokens
  }

  return verses;
};

// Process inline tokens (for paragraphs, list items, etc)
const processInlineTokens = (
  tokens: marked.Token[],
  depth: number = 0
): Inline[] => {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  // Safety check for maximum recursion depth
  const MAX_INLINE_DEPTH = 10;
  if (depth >= MAX_INLINE_DEPTH) {
    console.warn('Maximum inline token processing depth reached');
    return ['[Formatting too complex to display]'];
  }

  const inlines: Inline[] = [];
  let currentText = '';

  // Helper to flush accumulated text
  const flushText = () => {
    if (currentText) {
      inlines.push(currentText);
      currentText = '';
    }
  };

  for (const token of tokens) {
    if (token.type === 'text') {
      currentText += 'text' in token ? token.text : '';
    } else if (token.type === 'strong') {
      flushText();
      inlines.push({
        bold: processInlineTokens(token.tokens || [], depth + 1),
      });
    } else if (token.type === 'em') {
      flushText();
      inlines.push({
        italics: processInlineTokens(token.tokens || [], depth + 1),
      });
    } else if (token.type === 'codespan') {
      flushText();
      inlines.push({
        'inline-code': token.text,
      });
    } else if (token.type === 'del') {
      flushText();
      inlines.push({
        strike: processInlineTokens(token.tokens || [], depth + 1),
      });
    } else if (token.type === 'link') {
      flushText();
      inlines.push({
        link: {
          href: token.href,
          content: token.text,
        },
      });
    } else if (token.type === 'br') {
      flushText();
      inlines.push({ break: null });
    } else {
      // For any other token types, just use their text representation
      if ('text' in token && token.text) {
        currentText += token.text;
      }
    }
  }

  // Don't forget to add any remaining text
  flushText();

  return inlines.length ? inlines : [''];
};

// Process list items (including task lists)
const processListItems = (
  listToken: marked.Tokens.List,
  depth: number = 0
): Verse[] => {
  const verses: Verse[] = [];
  const MAX_NESTING_DEPTH = 8; // Support deeper nesting (at least 5 levels guaranteed)

  if (!listToken.items || !Array.isArray(listToken.items)) {
    return verses;
  }

  // Processes a list item and all of its nested content recursively
  const processItem = (
    item: marked.Tokens.ListItem,
    level: number,
    ordered: boolean,
    index: number
  ): void => {
    // Safety check for maximum depth
    if (level >= MAX_NESTING_DEPTH || depth + level >= MAX_NESTING_DEPTH) {
      verses.push({
        inline: [`${'  '.repeat(level)}• [Max nesting depth reached]`],
      } as Verse);
      return;
    }

    // Create list marker
    const indentPrefix = '  '.repeat(level);
    const listPrefix = ordered
      ? `${indentPrefix}${index + 1}. `
      : `${indentPrefix}• `;

    // Handle task items
    const prefix = item.task
      ? `${listPrefix}${item.checked ? '☑' : '☐'} `
      : listPrefix;

    // Process the current item content (excluding nested lists)
    const nonListContent = [];
    let nestedLists: marked.Tokens.List[] = [];

    // Separate list tokens from other content
    if (item.tokens) {
      for (const token of item.tokens) {
        if (token.type === 'list') {
          nestedLists.push(token as marked.Tokens.List);
        } else {
          nonListContent.push(token);
        }
      }
    }

    // Add the current item with its content
    verses.push({
      inline: [
        prefix,
        ...processInlineTokens(nonListContent, depth + level + 1),
      ],
    } as Verse);

    // Process any nested lists found in this item
    nestedLists.forEach((nestedList) => {
      if (nestedList.items && nestedList.items.length > 0) {
        nestedList.items.forEach((nestedItem, nestedIndex) => {
          processItem(nestedItem, level + 1, nestedList.ordered, nestedIndex);
        });
      }
    });
  };

  // Process all list items at the root level
  listToken.items.forEach((item, index) => {
    processItem(item, 0, listToken.ordered, index);
  });

  return verses;
};

// Helper function to process nested blockquote tokens
const processNestedBlockquoteTokens = (
  tokens: marked.Token[],
  depth: number = 0
): marked.Token[] => {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  // Extract all text from nested tokens
  const result: marked.Token[] = [];

  for (const token of tokens) {
    if (token.type === 'paragraph' && token.tokens) {
      // Add paragraph tokens directly
      result.push(...token.tokens);
    } else if (
      token.type === 'blockquote' &&
      'tokens' in token &&
      token.tokens
    ) {
      // For nested blockquotes, we need to add a prefix to indicate nesting
      const nestedTokens = processNestedBlockquoteTokens(
        token.tokens,
        depth + 1
      );

      // Add a '>' prefix token to indicate nesting
      const prefixToken: marked.Tokens.Text = {
        type: 'text',
        text: '> ',
        raw: '> ',
      };

      result.push(prefixToken);
      result.push(...nestedTokens);
    } else if ('text' in token) {
      // Add text tokens directly
      result.push(token);
    }
  }

  return result;
};

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

  try {
    // Parse the markdown to get tokens
    const tokens = marked.lexer(markdown);
    const story: Verse[] = [];

    // Process the top-level tokens with initial depth of 0
    story.push(...processTokens(tokens, 0));

    // If we couldn't parse anything properly, fallback to simple paragraph conversion
    if (story.length === 0) {
      const paragraphs = markdown.split(/\n\n+/);
      return paragraphs
        .map((para) => para.trim())
        .filter((para) => para.length > 0)
        .map(
          (para) =>
            ({
              inline: [para],
            }) as Verse
        );
    }

    return cleanupEmptyParagraphs(story);
  } catch (error) {
    // Fallback in case of exceptions during parsing
    console.error('Error parsing markdown:', error);
    return [
      {
        inline: [
          'Error parsing markdown: ' +
            (error instanceof Error ? error.message : String(error)),
        ],
      } as Verse,
    ];
  }
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
