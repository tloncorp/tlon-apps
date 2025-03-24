import {
  Block,
  List,
  ListItem,
  Listing,
  ListingBlock,
  Story,
  Verse,
} from '@tloncorp/shared/urbit/channel';
import { Inline } from '@tloncorp/shared/urbit/content';
import { marked } from 'marked';

/**
 * Improved list processing that uses proper List and ListItem structures
 * rather than flattening the hierarchy with indentation.
 *
 * This function replaces the processListItems function in markdown.ts
 * and creates a properly nested structure for lists.
 */
export function processListItemsAsListingBlock(
  listToken: marked.Tokens.List,
  depth: number = 0
): Verse[] {
  if (!listToken.items || !Array.isArray(listToken.items)) {
    return [];
  }

  // Create a top-level ListingBlock
  const listingBlock: Verse = {
    block: {
      listing: createListFromToken(listToken, depth),
    },
  };

  return [listingBlock];
}

/**
 * Create a List from a marked List token
 */
function createListFromToken(
  listToken: marked.Tokens.List,
  depth: number = 0
): List {
  const type = listToken.ordered
    ? 'ordered'
    : listToken.items.some((item) => item.task)
      ? 'tasklist'
      : 'unordered';

  // Convert each list item
  const items = listToken.items.map((item) =>
    createListingFromItem(item, depth + 1, type)
  );

  return {
    list: {
      type,
      items,
      contents: [], // Usually empty for markdown-generated lists
    },
  };
}

/**
 * Create a Listing (ListItem or nested List) from a marked ListItem token
 */
function createListingFromItem(
  item: marked.Tokens.ListItem,
  depth: number,
  parentType: 'ordered' | 'unordered' | 'tasklist'
): Listing {
  // Find any nested lists and separate them from regular content
  const nonListContent: marked.Token[] = [];
  const nestedLists: marked.Tokens.List[] = [];

  if (item.tokens) {
    for (const token of item.tokens) {
      if (token.type === 'list') {
        nestedLists.push(token as marked.Tokens.List);
      } else {
        nonListContent.push(token);
      }
    }
  }

  // Process the main content of this item
  let inlineContent: Inline[] = processInlineTokens(nonListContent, depth);

  // For task items, prepend a task marker
  if (item.task) {
    const taskMarker = item.checked ? '☑ ' : '☐ ';
    if (inlineContent.length > 0 && typeof inlineContent[0] === 'string') {
      inlineContent[0] = taskMarker + inlineContent[0];
    } else {
      inlineContent.unshift(taskMarker);
    }
  }

  // If there are nested lists, this becomes a List, otherwise a ListItem
  if (nestedLists.length > 0) {
    // Create a ListItem for the current content
    const currentItem: ListItem = {
      item: inlineContent,
    };

    // Create nested lists
    const nestedListings = nestedLists.map((nestedList) => {
      return createListFromToken(nestedList, depth + 1);
    });

    // Combine the current item with nested lists in a new List
    return {
      list: {
        type: parentType,
        items: [currentItem, ...nestedListings],
        contents: [],
      },
    };
  } else {
    // Simple ListItem with no nesting
    return {
      item: inlineContent,
    };
  }
}

/**
 * Process inline tokens from marked parser
 * This is a simplified version of the function in markdown.ts
 */
function processInlineTokens(
  tokens: marked.Token[],
  depth: number = 0
): Inline[] {
  if (!tokens || tokens.length === 0) {
    return [];
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
}

/**
 * Example of how to use this function in a component
 * that renders complex nested lists with proper formatting
 */
export function renderComplexNestedList(markdown: string): Story {
  // Parse the markdown to get tokens
  const tokens = marked.lexer(markdown);
  const story: Verse[] = [];

  // Find list tokens and process them with our new function
  for (const token of tokens) {
    if (token.type === 'list') {
      story.push(...processListItemsAsListingBlock(token));
    }
    // Handle other token types as needed
  }

  return story;
}

/**
 * Example of expected output from:
 *
 * * List with **bold text** and *italic text*
 *   * Nested list with `inline code`
 *     * Deeply nested with [a link](https://example.com)
 *
 * The structure will be:
 *
 * {
 *   block: {
 *     listing: {
 *       list: {
 *         type: "unordered",
 *         items: [
 *           {
 *             item: [
 *               "List with ",
 *               { bold: ["bold text"] },
 *               " and ",
 *               { italics: ["italic text"] }
 *             ]
 *           },
 *           {
 *             list: {
 *               type: "unordered",
 *               items: [
 *                 {
 *                   item: [
 *                     "Nested list with ",
 *                     { "inline-code": "inline code" }
 *                   ]
 *                 },
 *                 {
 *                   list: {
 *                     type: "unordered",
 *                     items: [
 *                       {
 *                         item: [
 *                           "Deeply nested with ",
 *                           {
 *                             link: {
 *                               href: "https://example.com",
 *                               content: "a link"
 *                             }
 *                           }
 *                         ]
 *                       }
 *                     ],
 *                     contents: []
 *                   }
 *                 }
 *               ],
 *               contents: []
 *             }
 *           }
 *         ],
 *         contents: []
 *       }
 *     }
 *   }
 * }
 */
