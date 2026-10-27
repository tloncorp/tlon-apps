/**
 * Plain-text rendering of a stored post for `tlon messages`.
 *
 * Posts read back through `@tloncorp/api` carry `content` as the serialized,
 * API-normalized story (cites already converted to `ContentReference`). This
 * parses and converts it with the api's own `convertContent` and prints the
 * structure a reader needs — image, video and link URLs, reference paths,
 * table rows — instead of the raw JSON, plus the post's blob attachments.
 */
import type { ContentReference, Post } from '@tloncorp/api';
import { parsePostBlob } from '@tloncorp/api/client/content-helpers';
import {
  type BlockData,
  type InlineData,
  type ListData,
  type PostContent,
  closesWithQuote,
  convertContent,
  opensWithBreak,
  opensWithQuote,
} from '@tloncorp/api/client/postContent';
import { contentReferenceToCite } from '@tloncorp/api/client/references';
import { citeToPath } from '@tloncorp/api/urbit';

// The notice the app renders for an unknown blob entry (`convertContent`).
const UNKNOWN_BLOB_ENTRY_NOTICE = 'Upgrade your app to see this post';

export type RenderablePost = Pick<
  Post,
  'content' | 'textContent' | 'blob' | 'title'
>;

export interface RenderedPost {
  lines: string[];
  /** Channel references in the story, in order, for `--resolve-cites`. */
  channelReferences: ContentReference[];
}

export interface WritePostBodyOptions {
  write: (line: string) => void;
  /** Prefix for every written line. */
  indent?: string;
  /**
   * When set, each channel reference is fetched and its body printed as a
   * `> ` quote under the post. Cited posts are not resolved recursively.
   */
  getPostReference?: (reference: {
    channelId: string;
    postId: string;
    replyId?: string;
  }) => Promise<RenderablePost>;
}

// Same quote-boundary rule as the api's `plaintextPreviewOfInlineString`,
// which sees through style wrappers: a quote starts and ends its own line.
function renderInlines(inlines: InlineData[]): string {
  let out = '';
  inlines.forEach((inline, index) => {
    const previous = index > 0 ? inlines[index - 1] : null;
    const quoteBoundary =
      opensWithQuote(inline) || (previous != null && closesWithQuote(previous));
    if (
      quoteBoundary &&
      !opensWithBreak(inline) &&
      out.length > 0 &&
      !out.endsWith('\n')
    ) {
      out += '\n';
    }
    out += renderInline(inline);
  });
  return out;
}

/** Prefix every line, so a quote with hard breaks stays a quote. */
function quoteLines(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function renderInline(inline: InlineData): string {
  switch (inline.type) {
    case 'style':
      return renderInlines(inline.children);
    case 'text':
      return inline.text;
    case 'mention':
      return inline.contactId.startsWith('~')
        ? inline.contactId
        : `~${inline.contactId}`;
    case 'groupMention':
      return `@${inline.group}`;
    case 'lineBreak':
      return '\n';
    case 'link': {
      const label = inline.text.trim();
      return !label || label === inline.href
        ? inline.href
        : `${label} (${inline.href})`;
    }
    case 'task':
      return `${inline.checked ? '[x] ' : '[ ] '}${renderInlines(inline.children)}`;
    case 'blockquote':
      return quoteLines(renderInlines(inline.children));
  }
}

function renderList(list: ListData, depth = 0): string[] {
  const lines: string[] = [];
  const head = renderInlines(list.content);
  if (head) lines.push(head);
  list.children?.forEach((child, index) => {
    const marker = list.type === 'ordered' ? `${index + 1}.` : '-';
    const [first = '', ...rest] = renderList(child, depth + 1);
    lines.push(`${'\t'.repeat(depth)}${marker} ${first}`, ...rest);
  });
  return lines;
}

function fileNameOf(src: string): string {
  try {
    const segment = new URL(src).pathname.split('/').filter(Boolean).at(-1);
    return segment ? decodeURIComponent(segment) : '';
  } catch {
    return '';
  }
}

export function referencePath(reference: ContentReference): string {
  // A content reference always becomes a chan, group or desk cite, each of
  // which has a path.
  return citeToPath(contentReferenceToCite(reference))!;
}

function renderBlock(block: BlockData): string[] {
  switch (block.type) {
    case 'paragraph':
      return [renderInlines(block.content)];
    case 'header':
      return [renderInlines(block.children)];
    case 'blockquote':
      return [quoteLines(renderInlines(block.content))];
    case 'list':
      return renderList(block.list);
    case 'code':
      return [`\`\`\`${block.lang ?? ''}\n${block.content}\n\`\`\``];
    case 'rule':
      return ['---'];
    case 'bigEmoji':
      return [block.emoji];
    case 'image': {
      const alt = block.alt?.trim() ?? '';
      const showAlt = alt && alt !== fileNameOf(block.src);
      return [`🖼 ${block.src}${showAlt ? ` (${alt})` : ''}`];
    }
    // A story video is an image block whose src is a video URL.
    case 'video':
      return [`🎬 ${block.video.src}`];
    case 'link':
      return [`🔗 ${block.url}${block.title ? ` — ${block.title}` : ''}`];
    case 'reference':
      return [`(Ref: ${referencePath(block)})`];
    case 'table': {
      const row = (cells: { content: InlineData[] }[]) =>
        cells.map((cell) => renderInlines(cell.content)).join(' | ');
      return [
        row(block.header.cells),
        block.header.cells.map(() => '---').join(' | '),
        ...block.rows.map((bodyRow) => row(bodyRow.cells)),
      ];
    }
    // Attachment blocks only come from the blob, which is rendered
    // separately (`convertContent` is called without it).
    case 'file':
    case 'voicememo':
    case 'a2ui':
      return [];
  }
}

function formatSize(size: number | undefined): string {
  return typeof size === 'number' && size >= 0
    ? `${Math.round(size / 1024)}KB`
    : 'unknown';
}

function renderBlob(blob: string): string[] {
  const lines: string[] = [];
  try {
    for (const entry of parsePostBlob(blob)) {
      if (entry.type === 'file') {
        lines.push(
          `📎 [${entry.name || 'file'}] (${entry.mimeType || 'unknown'}, ${formatSize(entry.size)})`
        );
        if (entry.fileUri) lines.push(`   ${entry.fileUri}`);
      } else if (entry.type === 'voicememo') {
        const dur = entry.duration ? `${Math.round(entry.duration)}s` : '?';
        lines.push(`🎙️ [voice memo] (${dur})`);
        if (entry.transcription) lines.push(`   "${entry.transcription}"`);
      } else if (entry.type === 'video') {
        lines.push(
          `🎬 [${entry.name || 'video'}] (${entry.mimeType || 'video'})`
        );
        if (entry.fileUri) lines.push(`   ${entry.fileUri}`);
      } else if (entry.type === 'unknown') {
        // A malformed entry or a type from a newer client: the app's notice.
        lines.push(UNKNOWN_BLOB_ENTRY_NOTICE);
      }
    }
  } catch {
    lines.push('[attachment could not be read]');
  }
  return lines;
}

/**
 * Render a post's title, story and blob as plain-text lines. Never throws: a
 * story that cannot be parsed or converted falls back to the post's stored
 * plain-text preview (never the raw JSON), and the blob lines, which do not
 * depend on the story, are rendered either way.
 */
export function renderPostBody(post: RenderablePost): RenderedPost {
  const lines: string[] = [];
  const channelReferences: ContentReference[] = [];

  if (post.title) lines.push(`Title: ${post.title}`);

  let blocks: PostContent | null = null;
  if (post.content != null && post.content !== '') {
    try {
      const parsed: unknown =
        typeof post.content === 'string'
          ? JSON.parse(post.content)
          : post.content;
      blocks = convertContent(parsed, undefined);
    } catch {
      blocks = null;
    }
  } else {
    blocks = [];
  }

  if (blocks) {
    for (const block of blocks) {
      if (block.type === 'reference' && block.referenceType === 'channel') {
        channelReferences.push(block);
      }
      for (const text of renderBlock(block)) {
        lines.push(...text.split('\n'));
      }
    }
  } else if (post.textContent) {
    lines.push(...post.textContent.split('\n'));
  }

  if (post.blob) lines.push(...renderBlob(post.blob));

  return { lines, channelReferences };
}

/**
 * Write a post's rendered body, then — when a resolver is given — the body
 * of each channel reference it cites, quoted. A failed lookup is skipped.
 */
export async function writePostBody(
  post: RenderablePost,
  options: WritePostBodyOptions
): Promise<void> {
  const indent = options.indent ?? '';
  const rendered = renderPostBody(post);
  for (const line of rendered.lines) options.write(`${indent}${line}`);

  if (!options.getPostReference) return;
  for (const reference of rendered.channelReferences) {
    if (reference.referenceType !== 'channel') continue;
    let cited: RenderablePost;
    try {
      cited = await options.getPostReference({
        channelId: reference.channelId,
        postId: reference.postId,
        replyId: reference.replyId,
      });
    } catch {
      continue;
    }
    for (const line of renderPostBody(cited).lines) {
      options.write(`${indent}> ${line}`);
    }
  }
}
