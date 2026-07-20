import { markdownToStory } from '@tloncorp/api/client/markdown';
import {
  type BlockData,
  type InlineData,
  type ListData,
  type PostContent,
  type TableRowData,
  convertContent,
} from '@tloncorp/api/client/postContent';

export function publishedNotePath(notebookFlag: string, noteId: number) {
  return `/notes/pub/${notebookFlag}/${noteId}`;
}

export function publishedNoteUrl(path: string, shipUrl?: string | null) {
  return shipUrl ? new URL(path, shipUrl).toString() : null;
}

const publishedNoteCss = `
:root{color-scheme:dark light;--background:#1A1818;--primary-text:#FFFFFF;--tertiary-text:#808080;--border:#333333;--secondary-background:#322E2E;--action-text:#4E91F5}
@media(prefers-color-scheme:light){:root{--background:#FFFFFF;--primary-text:#1A1818;--tertiary-text:#999999;--border:#E5E5E5;--secondary-background:#F5F5F5;--action-text:#3B80E8}}
*{box-sizing:border-box}
body{margin:0;padding:48px 24px;background:var(--background);color:var(--primary-text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto}
h1,h2,h3,h4,h5,h6{line-height:1.2;color:var(--primary-text);margin:1.4em 0 .45em}
main>h1:first-child{margin-top:0;font-size:24px;font-weight:400}
p,blockquote,pre,ul,ol,.tlon-table-scroll{margin:1em 0}
a{color:var(--action-text)}
code,pre{font-family:"SFMono-Regular","JetBrains Mono",monospace;background:var(--secondary-background)}
code{padding:2px 5px;border-radius:4px}
pre{padding:16px;border:1px solid var(--border);border-radius:8px;overflow:auto}
pre code{padding:0;background:transparent}
blockquote{border-left:3px solid var(--action-text);padding-left:16px;color:var(--tertiary-text)}
hr{border:0;border-top:1px solid var(--border);margin:2em 0}
img,video{max-width:100%;border-radius:8px}
.tlon-table-scroll{max-width:100%;overflow-x:auto}
table{border-collapse:collapse;width:max-content;min-width:100%;font-size:14px;line-height:20px}
tr{border-bottom:1px solid var(--border)}
tbody tr:last-child{border-bottom:0}
th,td{border:0;max-width:280px;padding:16px 12px;vertical-align:top;overflow-wrap:anywhere}
th:first-child,td:first-child{padding-left:0}
th{background:transparent;color:var(--tertiary-text);font-weight:400}
.tlon-table-cell-content{width:max-content;max-width:280px}
.tlon-table-data-cell{width:1px}
.tlon-table-spacer{padding:0}
.tlon-published-footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--border);color:var(--tertiary-text);font-size:12px}
`.trim();
const inlineStyleTags = {
  bold: 'strong',
  code: 'code',
  italic: 'em',
  strikethrough: 's',
} as const;

export function renderPublishedNoteHtml({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const safeTitle = title.trim() || 'Untitled';
  const bodyHtml = renderMarkdownBodyHtml(body);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(safeTitle)}</title>
<style>${publishedNoteCss}</style>
</head>
<body>
<main>
<h1>${escapeHtml(safeTitle)}</h1>
${bodyHtml || '<p></p>'}
<div class="tlon-published-footer">Published from Tlon</div>
</main>
</body>
</html>`;
}

function renderMarkdownBodyHtml(body: string) {
  try {
    return renderBlocksToHtml(convertContent(markdownToStory(body), null));
  } catch {
    return renderPlainTextHtml(body);
  }
}

function renderPlainTextHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`
    )
    .join('\n');
}

function renderBlocksToHtml(blocks: PostContent) {
  return blocks.map(renderBlockToHtml).filter(Boolean).join('\n');
}

function renderBlockToHtml(block: BlockData): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${renderInlinesToHtml(block.content)}</p>`;
    case 'blockquote':
      return `<blockquote>${renderInlinesToHtml(block.content)}</blockquote>`;
    case 'bigEmoji':
      return `<p>${escapeHtml(block.emoji)}</p>`;
    case 'header': {
      const level = block.level.replace('h', '');
      return `<h${level}>${renderInlinesToHtml(block.children)}</h${level}>`;
    }
    case 'code':
      return `<pre><code>${escapeHtml(block.content)}</code></pre>`;
    case 'image':
      return `<img src="${safeUrlAttr(block.src)}" alt="${escapeAttr(block.alt)}">`;
    case 'video':
      return `<video controls src="${safeUrlAttr(block.video.src)}">${escapeHtml(block.video.alt)}</video>`;
    case 'link':
      return `<p><a href="${safeUrlAttr(block.url)}">${escapeHtml(block.title || block.url)}</a></p>`;
    case 'rule':
      return '<hr>';
    case 'list':
      return renderListToHtml(block.list);
    case 'table':
      return renderTableToHtml(block);
    case 'reference':
      return `<p>${escapeHtml(referenceLabel(block))}</p>`;
    case 'file':
    case 'voicememo':
    case 'a2ui':
      return '';
  }
}

function renderInlinesToHtml(inlines: InlineData[]) {
  return inlines.map(renderInlineToHtml).join('');
}

function renderInlineToHtml(inline: InlineData): string {
  switch (inline.type) {
    case 'text':
      return escapeHtml(inline.text);
    case 'mention':
      return escapeHtml(inline.contactId);
    case 'groupMention':
      return escapeHtml(`@${inline.group}`);
    case 'lineBreak':
      return '<br>';
    case 'link':
      return `<a href="${safeUrlAttr(inline.href)}">${escapeHtml(inline.text || inline.href)}</a>`;
    case 'task':
      return `${inline.checked ? '[x]' : '[ ]'} ${renderInlinesToHtml(inline.children)}`;
    case 'style': {
      const children = renderInlinesToHtml(inline.children);
      const tag = inlineStyleTags[inline.style];
      return `<${tag}>${children}</${tag}>`;
    }
  }
}

function renderListToHtml(list: ListData) {
  const tag = listTag(list);
  const items = [
    ...(list.content.length > 0
      ? [`<li>${renderInlinesToHtml(list.content)}</li>`]
      : []),
    ...(list.children?.map(renderListItemToHtml) ?? []),
  ];
  return `<${tag}>${items.join('')}</${tag}>`;
}

function renderListItemToHtml(item: ListData): string {
  const children = item.children?.map(renderListItemToHtml).join('') ?? '';
  return `<li>${renderInlinesToHtml(item.content)}${
    children ? `<${listTag(item)}>${children}</${listTag(item)}>` : ''
  }</li>`;
}

function listTag(list: ListData) {
  return list.type === 'ordered' ? 'ol' : 'ul';
}

function renderTableToHtml(block: Extract<BlockData, { type: 'table' }>) {
  const header = renderTableRowToHtml(block.header, block.align, 'th');
  const rows = block.rows
    .map((row) => renderTableRowToHtml(row, block.align, 'td'))
    .join('');
  return `<div class="tlon-table-scroll"><table><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
}

function renderTableRowToHtml(
  row: TableRowData,
  align: Extract<BlockData, { type: 'table' }>['align'],
  cellTag: 'td' | 'th'
) {
  const cells = row.cells
    .map((cell, index) => {
      const textAlign = align[index]
        ? ` style="text-align:${align[index]}"`
        : '';
      return `<${cellTag} class="tlon-table-data-cell"${textAlign}><div class="tlon-table-cell-content">${renderInlinesToHtml(cell.content)}</div></${cellTag}>`;
    })
    .join('');
  return `<tr>${cells}<${cellTag} class="tlon-table-spacer" aria-hidden="true"></${cellTag}></tr>`;
}

function referenceLabel(block: Extract<BlockData, { type: 'reference' }>) {
  switch (block.referenceType) {
    case 'channel':
      return block.replyId
        ? `Reply in ${block.channelId}`
        : `Post in ${block.channelId}`;
    case 'group':
      return `Group ${block.groupId}`;
    case 'app':
      return `${block.userId}/${block.appId}`;
  }
}

function safeUrlAttr(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '#';
  if (trimmed.startsWith('/') || trimmed.startsWith('#'))
    return escapeAttr(trimmed);
  try {
    const url = new URL(trimmed);
    if (['http:', 'https:', 'mailto:'].includes(url.protocol))
      return escapeAttr(trimmed);
  } catch {
    return '#';
  }
  return '#';
}

function escapeAttr(value: string | null | undefined) {
  return escapeHtml(value ?? '').replace(/"/g, '&quot;');
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
