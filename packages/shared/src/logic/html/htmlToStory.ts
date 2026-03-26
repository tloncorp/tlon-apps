import {
  Block,
  Inline,
  HeaderLevel,
} from '@tloncorp/api/urbit/content';
import { Story, Verse } from '@tloncorp/api/urbit/channel';

/**
 * Minimal HTML node representation for parsing.
 */
interface HtmlNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  children?: HtmlNode[];
  text?: string;
}

/**
 * Unescape HTML entities.
 */
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parse an HTML string into a tree of HtmlNode objects.
 * This is a simple parser sufficient for the canonical HTML subset
 * produced by react-native-enriched.
 */
function parseHtml(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = [];
  let pos = 0;

  function parseNodes(): HtmlNode[] {
    const result: HtmlNode[] = [];

    while (pos < html.length) {
      if (html[pos] === '<') {
        // Check for closing tag
        if (html[pos + 1] === '/') {
          // We've hit a closing tag — return to parent
          break;
        }

        // Parse opening tag
        const tagStart = pos;
        pos++; // skip '<'

        // Check for self-closing tags like <br>, <hr>, <img>
        // Parse tag name
        let tagName = '';
        while (pos < html.length && html[pos] !== ' ' && html[pos] !== '>' && html[pos] !== '/') {
          tagName += html[pos];
          pos++;
        }
        tagName = tagName.toLowerCase();

        // Parse attributes
        const attrs: Record<string, string> = {};
        while (pos < html.length && html[pos] !== '>' && html[pos] !== '/') {
          // Skip whitespace
          while (pos < html.length && html[pos] === ' ') pos++;
          if (html[pos] === '>' || html[pos] === '/') break;

          // Parse attribute name
          let attrName = '';
          while (pos < html.length && html[pos] !== '=' && html[pos] !== ' ' && html[pos] !== '>' && html[pos] !== '/') {
            attrName += html[pos];
            pos++;
          }

          if (html[pos] === '=') {
            pos++; // skip '='
            let quote = '';
            if (html[pos] === '"' || html[pos] === "'") {
              quote = html[pos];
              pos++; // skip opening quote
            }

            let attrValue = '';
            if (quote) {
              while (pos < html.length && html[pos] !== quote) {
                attrValue += html[pos];
                pos++;
              }
              if (pos < html.length) pos++; // skip closing quote
            } else {
              while (pos < html.length && html[pos] !== ' ' && html[pos] !== '>') {
                attrValue += html[pos];
                pos++;
              }
            }
            attrs[attrName.toLowerCase()] = unescapeHtml(attrValue);
          } else if (attrName) {
            attrs[attrName.toLowerCase()] = '';
          }
        }

        // Skip self-closing slash
        if (html[pos] === '/') pos++;
        // Skip '>'
        if (html[pos] === '>') pos++;

        // Self-closing / void elements
        const voidElements = new Set(['br', 'hr', 'img', 'input']);
        if (voidElements.has(tagName)) {
          result.push({ type: 'element', tag: tagName, attrs, children: [] });
          continue;
        }

        // Parse children
        const children = parseNodes();

        // Skip closing tag
        if (pos < html.length && html[pos] === '<' && html[pos + 1] === '/') {
          // Find '>'
          while (pos < html.length && html[pos] !== '>') pos++;
          if (pos < html.length) pos++; // skip '>'
        }

        result.push({ type: 'element', tag: tagName, attrs, children });
      } else {
        // Parse text node
        let text = '';
        while (pos < html.length && html[pos] !== '<') {
          text += html[pos];
          pos++;
        }
        if (text) {
          result.push({ type: 'text', text: unescapeHtml(text) });
        }
      }
    }

    return result;
  }

  nodes.push(...parseNodes());
  return nodes;
}

/**
 * Convert parsed HTML nodes to Story Inline elements.
 */
function nodesToInlines(nodes: HtmlNode[]): Inline[] {
  const inlines: Inline[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.text) {
        inlines.push(node.text);
      }
      continue;
    }

    const tag = node.tag;
    const children = node.children ?? [];

    switch (tag) {
      case 'strong':
      case 'b':
        inlines.push({ bold: nodesToInlines(children) });
        break;

      case 'em':
      case 'i':
        inlines.push({ italics: nodesToInlines(children) });
        break;

      case 'del':
      case 's':
      case 'strike':
        inlines.push({ strike: nodesToInlines(children) });
        break;

      case 'code':
        // Inline code — collect all text content
        inlines.push({ 'inline-code': collectText(children) });
        break;

      case 'a': {
        const href = node.attrs?.href ?? '';
        const content = collectText(children);
        inlines.push({ link: { href, content } });
        break;
      }

      case 'br':
        inlines.push({ break: null });
        break;

      case 'img': {
        const src = node.attrs?.src ?? '';
        const alt = node.attrs?.alt ?? '';
        const width = parseInt(node.attrs?.width ?? '0', 10) || 0;
        const height = parseInt(node.attrs?.height ?? '0', 10) || 0;
        inlines.push({
          image: { src, height, width, alt },
        } as unknown as Inline);
        break;
      }

      case 'mention': {
        // Native enriched mention tag: <mention text="display" indicator="@" id="~zod">
        const id = node.attrs?.id ?? '';
        const shipName = id.startsWith('~') ? id.slice(1) : id;
        if (shipName) {
          inlines.push({ ship: shipName });
        }
        break;
      }

      case 'span': {
        // Check for mention data attribute (from storyToHtml output)
        const mentionId = node.attrs?.['data-mention'];
        if (mentionId) {
          const shipName = mentionId.startsWith('~')
            ? mentionId.slice(1)
            : mentionId;
          inlines.push({ ship: shipName });
        } else {
          // Regular span — pass through children
          inlines.push(...nodesToInlines(children));
        }
        break;
      }

      default:
        // Unknown inline tag — process children
        inlines.push(...nodesToInlines(children));
        break;
    }
  }

  return inlines;
}

/**
 * Collect all text content from nodes recursively.
 */
function collectText(nodes: HtmlNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text ?? '';
      return collectText(n.children ?? []);
    })
    .join('');
}

/**
 * Convert a top-level HTML node to a Story Verse (or multiple verses).
 */
function nodeToVerses(node: HtmlNode): Verse[] {
  if (node.type === 'text') {
    const text = node.text?.trim();
    if (!text) return [];
    return [{ inline: [text] }];
  }

  const tag = node.tag;
  const children = node.children ?? [];

  switch (tag) {
    case 'p': {
      const inlines = nodesToInlines(children);
      if (inlines.length === 0) return [];
      return [{ inline: inlines }];
    }

    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const block: Block = {
        header: {
          tag: tag as HeaderLevel,
          content: nodesToInlines(children),
        },
      };
      return [{ block }];
    }

    case 'blockquote': {
      // Blockquote children are usually <p> elements
      // Flatten them into a single inline array
      const allInlines: Inline[] = [];
      for (const child of children) {
        if (child.type === 'element' && child.tag === 'p') {
          if (allInlines.length > 0) {
            allInlines.push({ break: null });
          }
          allInlines.push(...nodesToInlines(child.children ?? []));
        } else {
          allInlines.push(...nodesToInlines([child]));
        }
      }
      // Represent as inline blockquote within a VerseInline
      return [{ inline: [{ blockquote: allInlines }] }];
    }

    case 'pre': {
      // Code block — get text from <code> child if present
      let codeText = '';
      const codeChild = children.find(
        (c) => c.type === 'element' && c.tag === 'code'
      );
      if (codeChild) {
        codeText = collectText(codeChild.children ?? []);
      } else {
        codeText = collectText(children);
      }
      const block: Block = { code: { code: codeText, lang: '' } };
      return [{ block }];
    }

    case 'ul':
    case 'ol': {
      const listType = tag === 'ol' ? 'ordered' : 'unordered';
      const items = listItemsFromNodes(children, listType);
      const block: Block = {
        listing: {
          list: {
            type: listType as 'ordered' | 'unordered',
            items,
            contents: [],
          },
        },
      };
      return [{ block }];
    }

    case 'hr':
      return [{ block: { rule: null } }];

    case 'img': {
      const src = node.attrs?.src ?? '';
      const alt = node.attrs?.alt ?? '';
      const width = parseInt(node.attrs?.width ?? '0', 10) || 0;
      const height = parseInt(node.attrs?.height ?? '0', 10) || 0;
      const block: Block = { image: { src, height, width, alt } };
      return [{ block }];
    }

    case 'br':
      return [];

    case 'div':
      // Treat div as a container — process children as top-level
      return children.flatMap(nodeToVerses);

    default:
      // Unknown block-level tag — try to extract inlines
      const inlines = nodesToInlines(children);
      if (inlines.length === 0) return [];
      return [{ inline: inlines }];
  }
}

/**
 * Convert <li> child nodes into Story Listing items.
 */
function listItemsFromNodes(
  nodes: HtmlNode[],
  listType: string
): import('@tloncorp/api/urbit/content').Listing[] {
  const items: import('@tloncorp/api/urbit/content').Listing[] = [];

  for (const node of nodes) {
    if (node.type !== 'element' || node.tag !== 'li') continue;

    const children = node.children ?? [];

    // Check for nested lists
    const nestedList = children.find(
      (c) =>
        c.type === 'element' && (c.tag === 'ul' || c.tag === 'ol')
    );

    if (nestedList) {
      // Has nested list — separate contents from nested list
      const contentNodes = children.filter((c) => c !== nestedList);
      const contents = nodesToInlines(contentNodes);
      const nestedType =
        nestedList.tag === 'ol' ? 'ordered' : 'unordered';
      const nestedItems = listItemsFromNodes(
        nestedList.children ?? [],
        nestedType
      );

      items.push({
        list: {
          type: nestedType as 'ordered' | 'unordered',
          items: nestedItems,
          contents,
        },
      });
    } else {
      // Check for checkbox (task list)
      const hasCheckbox = children.some(
        (c) =>
          c.type === 'element' &&
          c.tag === 'input' &&
          c.attrs?.type === 'checkbox'
      );

      if (hasCheckbox) {
        const checkbox = children.find(
          (c) =>
            c.type === 'element' &&
            c.tag === 'input' &&
            c.attrs?.type === 'checkbox'
        );
        const checked = checkbox?.attrs?.checked !== undefined;
        const contentNodes = children.filter((c) => c !== checkbox);
        // Unwrap <p> tags inside <li>
        const unwrapped = unwrapParagraphs(contentNodes);
        const content = nodesToInlines(unwrapped);

        items.push({
          item: [{ task: { checked, content } }],
        });
      } else {
        // Regular list item — unwrap <p> tags
        const unwrapped = unwrapParagraphs(children);
        const inlines = nodesToInlines(unwrapped);
        items.push({ item: inlines });
      }
    }
  }

  return items;
}

/**
 * Unwrap <p> tags inside list items, joining with breaks.
 */
function unwrapParagraphs(nodes: HtmlNode[]): HtmlNode[] {
  const result: HtmlNode[] = [];
  let addedParagraph = false;

  for (const node of nodes) {
    if (node.type === 'element' && node.tag === 'p') {
      if (addedParagraph) {
        result.push({ type: 'element', tag: 'br', children: [] });
      }
      result.push(...(node.children ?? []));
      addedParagraph = true;
    } else {
      result.push(node);
    }
  }

  return result;
}

/**
 * Convert an HTML string to a Story (Verse[]).
 *
 * Parses HTML from react-native-enriched's getHTML() output and converts
 * it to the Story format used by the backend.
 *
 * Supports: <p>, <h1>-<h6>, <strong>/<b>, <em>/<i>, <del>/<s>,
 * <code>, <pre>, <blockquote>, <ul>, <ol>, <li>, <a>, <img>, <br>, <hr>
 */
export function htmlToStory(html: string): Story {
  if (!html || html.trim() === '') {
    return [];
  }

  const nodes = parseHtml(html);
  const verses = nodes.flatMap(nodeToVerses);

  // Filter out empty verses
  return verses.filter((verse) => {
    if ('inline' in verse) {
      return verse.inline.length > 0;
    }
    return true;
  });
}
