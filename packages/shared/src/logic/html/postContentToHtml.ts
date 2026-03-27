import type {
  BlockData,
  InlineData,
  ListData,
  PostContent,
} from '@tloncorp/api/lib/postContent';

/**
 * Escape HTML special characters in text content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert InlineData[] to HTML string.
 */
function inlineDataToHtml(inlines: InlineData[]): string {
  return inlines
    .map((inline) => {
      switch (inline.type) {
        case 'text':
          return escapeHtml(inline.text);
        case 'style': {
          const inner = inlineDataToHtml(inline.children);
          switch (inline.style) {
            case 'bold':
              return `<b>${inner}</b>`;
            case 'italic':
              return `<i>${inner}</i>`;
            case 'strikethrough':
              return `<s>${inner}</s>`;
            case 'code':
              return `<code>${inner}</code>`;
            default:
              return inner;
          }
        }
        case 'mention':
          return `<mention text="${escapeHtml(inline.contactId)}" indicator="~" id="~${escapeHtml(inline.contactId)}">~${escapeHtml(inline.contactId)}</mention>`;
        case 'groupMention':
          return `@${escapeHtml(inline.group)}`;
        case 'lineBreak':
          return '<br>';
        case 'link':
          return `<a href="${escapeHtml(inline.href)}">${escapeHtml(inline.text)}</a>`;
        case 'task': {
          // Tasks are rendered via <li checked> in the tasklist context,
          // but if encountered inline, just render the content
          return inlineDataToHtml(inline.children);
        }
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Convert ListData to HTML.
 * ListData has content (inline text for this item) and optional children (nested items).
 */
function listDataToHtml(list: ListData, isRoot = true): string {
  const isTasklist = list.type === 'tasklist';
  const tag = isTasklist
    ? 'ul data-type="checkbox"'
    : list.type === 'ordered'
      ? 'ol'
      : 'ul';
  const closeTag = isTasklist ? 'ul' : tag;
  const inner = inlineDataToHtml(list.content);

  // If this is the root list block, wrap items in the list tag
  if (isRoot) {
    let items = `<li>${inner}</li>`;
    if (list.children && list.children.length > 0) {
      items = list.children
        .map((child) => {
          const childInner = inlineDataToHtml(child.content);
          const nested =
            child.children && child.children.length > 0
              ? listDataToHtml(child, false)
              : '';
          return `<li>${childInner}${nested}</li>`;
        })
        .join('');
      // If root has content too, prepend it
      if (inner) {
        items = `<li>${inner}</li>${items}`;
      }
    }
    return `<${tag}>${items}</${closeTag}>`;
  }

  // Nested list
  let items = '';
  if (list.children && list.children.length > 0) {
    items = list.children
      .map((child) => {
        const childInner = inlineDataToHtml(child.content);
        const nested =
          child.children && child.children.length > 0
            ? listDataToHtml(child, false)
            : '';
        return `<li>${childInner}${nested}</li>`;
      })
      .join('');
  }
  if (inner) {
    items = `<li>${inner}</li>${items}`;
  }
  return `<${tag}>${items}</${tag}>`;
}

/**
 * Convert a BlockData to HTML string.
 */
function blockDataToHtml(block: BlockData): string {
  switch (block.type) {
    case 'paragraph': {
      const inner = inlineDataToHtml(block.content);
      return inner ? `<p>${inner}</p>` : '';
    }
    case 'header': {
      const tag = block.level;
      const inner = inlineDataToHtml(block.children);
      return `<${tag}>${inner}</${tag}>`;
    }
    case 'blockquote': {
      const inner = inlineDataToHtml(block.content);
      return `<blockquote><p>${inner}</p></blockquote>`;
    }
    case 'code':
      return `<pre><code>${escapeHtml(block.content)}</code></pre>`;
    case 'image': {
      const alt = block.alt ? ` alt="${escapeHtml(block.alt)}"` : '';
      return `<p><img src="${escapeHtml(block.src)}"${alt}></p>`;
    }
    case 'rule':
      return '<hr>';
    case 'list':
      return listDataToHtml(block.list);
    default:
      return '';
  }
}

/**
 * Convert PostContent (BlockData[]) to HTML string suitable for
 * react-native-enriched's defaultValue/setValue.
 *
 * Wraps output in <html> tags as required by the enriched editor.
 */
export function postContentToHtml(content: PostContent): string {
  if (!content || content.length === 0) {
    return '';
  }

  const innerHtml = content.map(blockDataToHtml).filter(Boolean).join('');
  return innerHtml ? `<html>${innerHtml}</html>` : '';
}
