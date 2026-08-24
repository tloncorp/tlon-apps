/**
 * Post-content parsing and reference rendering for `tlon messages`.
 *
 * Lives outside `messages.ts` because that script runs `main()` at import, so
 * nothing defined in it is reachable from a test. Keep this module
 * side-effect free.
 */
import { getTextContent, parsePostBlob } from '@tloncorp/api';
import type {
  ClientPostBlobData,
  ContentReference,
  Post,
  PostContent,
} from '@tloncorp/api';

/** Story-level content: the array shape `getTextContent` consumes. */
export type StoryContent = Exclude<PostContent, null>;

/** Channel-cite fetches allowed per CLI invocation. */
export const REF_RESOLUTION_LIMIT = 3;

/**
 * Shared, mutable resolution allowance. Each `getPostReference` can burn its
 * own 3s subscribe timeout and posts print sequentially, so the cap is per
 * command rather than per post — otherwise a 20-post run could stall well
 * past the callers' CLI deadlines.
 */
export interface RefBudget {
  remaining: number;
}

export type FetchRef = (ref: {
  channelId: string;
  postId: string;
  replyId?: string;
}) => Promise<{ content?: unknown } | null | undefined>;

export interface RenderRefLinesOptions {
  resolve: boolean;
  fetchRef: FetchRef;
  budget: RefBudget;
}

// Same shape as the hermes flag regex. `toContentReference` copies `cite.group`
// through without a runtime check, and CLI stdout is handed verbatim to models,
// so a newline-bearing value could forge record framing.
const GROUP_ID_RE = /^~[a-z-]+\/[a-zA-Z0-9-]+$/;

export function createRefBudget(
  limit: number = REF_RESOLUTION_LIMIT
): RefBudget {
  return { remaining: limit };
}

/**
 * Normalize a post's `content` into story form. Fetchers hand back
 * `JSON.stringify`d content (`toPostData`), so the string case is the common
 * one. Returns `null` — not a fallback string — for anything that is not a
 * story array, leaving the choice of fallback to the caller.
 */
export function parsePostContent(content: unknown): StoryContent | null {
  let raw = content;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    // Boundary cast: element shapes are unverified wire data, and every
    // consumer here (`getTextContent`, the reference filter) narrows per
    // element before touching it.
    return raw as StoryContent;
  }
  if (
    !!raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as { story?: unknown }).story)
  ) {
    return (raw as { story: unknown[] }).story as StoryContent;
  }
  return null;
}

function rawContentText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}

// `getTextContent` is a preview renderer: it drops the href of a labeled link,
// prints an image block as the literal `(Image)`, and renders a link block as
// nothing at all. The raw-JSON body output this module replaced carried those
// hrefs and srcs, and a model reading CLI output needs the URL to act on it —
// so rewrite the URL-bearing shapes into plain text before handing the story
// over. Markdown link syntax is what bots send in the first place.
const NESTED_INLINE_KEYS = ['bold', 'italics', 'strike', 'blockquote'] as const;

function withUrlFidelityInline(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item;
  const obj = item as Record<string, unknown>;

  const link = obj.link;
  if (!!link && typeof link === 'object') {
    const { href, content } = link as { href?: unknown; content?: unknown };
    if (typeof href !== 'string') return item;
    return typeof content === 'string' && content.length > 0 && content !== href
      ? `[${content}](${href})`
      : href;
  }

  const task = obj.task;
  if (!!task && typeof task === 'object') {
    const fields = task as Record<string, unknown>;
    if (Array.isArray(fields.content)) {
      return {
        ...obj,
        task: {
          ...fields,
          content: fields.content.map(withUrlFidelityInline),
        },
      };
    }
  }

  for (const key of NESTED_INLINE_KEYS) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return { ...obj, [key]: nested.map(withUrlFidelityInline) };
    }
  }
  return item;
}

/**
 * A listing is the recursive list tree: either `{list: {items, contents}}`,
 * whose `items` are themselves listings, or a leaf `{item: Inline[]}`. Both
 * inline arrays carry links, so both are rewritten on the way down.
 */
function withUrlFidelityListing(listing: unknown): unknown {
  if (!listing || typeof listing !== 'object') return listing;
  const obj = listing as Record<string, unknown>;

  const list = obj.list;
  if (!!list && typeof list === 'object') {
    const fields = list as Record<string, unknown>;
    const next: Record<string, unknown> = { ...fields };
    if (Array.isArray(fields.contents)) {
      next.contents = fields.contents.map(withUrlFidelityInline);
    }
    if (Array.isArray(fields.items)) {
      next.items = fields.items.map(withUrlFidelityListing);
    }
    return { ...obj, list: next };
  }

  if (Array.isArray(obj.item)) {
    return { ...obj, item: obj.item.map(withUrlFidelityInline) };
  }
  return listing;
}

/** Non-mutating rewrite of the URL-bearing verses `getTextContent` flattens. */
function withUrlFidelity(story: StoryContent): StoryContent {
  return story.map((verse) => {
    if (!verse || typeof verse !== 'object') return verse;
    // Boundary cast, as in `parsePostContent`: verse shapes are unverified
    // wire data and every branch below narrows before touching a field.
    const obj = verse as unknown as Record<string, unknown>;

    if (Array.isArray(obj.inline)) {
      return { ...obj, inline: obj.inline.map(withUrlFidelityInline) };
    }

    const block = obj.block;
    if (!block || typeof block !== 'object') return verse;
    const inner = block as Record<string, unknown>;

    const image = inner.image;
    if (!!image && typeof image === 'object') {
      const { src, alt } = image as { src?: unknown; alt?: unknown };
      if (typeof src === 'string') {
        const label =
          typeof alt === 'string' && alt.length > 0 ? ` (${alt})` : '';
        return { inline: [`${src}${label}`] };
      }
    }

    const link = inner.link;
    if (!!link && typeof link === 'object') {
      const { url, meta } = link as { url?: unknown; meta?: unknown };
      if (typeof url === 'string') {
        const title =
          !!meta && typeof meta === 'object'
            ? (meta as { title?: unknown }).title
            : undefined;
        const label =
          typeof title === 'string' && title.length > 0 ? ` (${title})` : '';
        return { inline: [`${url}${label}`] };
      }
    }

    const header = inner.header;
    if (!!header && typeof header === 'object') {
      const fields = header as Record<string, unknown>;
      if (Array.isArray(fields.content)) {
        return {
          ...obj,
          block: {
            ...inner,
            header: {
              ...fields,
              content: fields.content.map(withUrlFidelityInline),
            },
          },
        };
      }
    }

    const listing = inner.listing;
    if (!!listing && typeof listing === 'object') {
      return {
        ...obj,
        block: { ...inner, listing: withUrlFidelityListing(listing) },
      };
    }

    return verse;
  }) as StoryContent;
}

/** Plaintext body of a post, with `(Ref)` markers left in story position. */
export function extractPostText(content: unknown): string {
  const parsed = parsePostContent(content);
  if (parsed === null) {
    return rawContentText(content);
  }
  try {
    return getTextContent(withUrlFidelity(parsed));
  } catch {
    // `getTextContent` narrows each element with `'type' in verse`, which
    // throws on `null`/scalar elements — print the raw form rather than lose
    // the message.
    return rawContentText(content);
  }
}

export function extractReferences(content: unknown): ContentReference[] {
  const parsed = parsePostContent(content);
  if (parsed === null) return [];
  return parsed.filter(
    (verse): verse is ContentReference =>
      !!verse &&
      typeof verse === 'object' &&
      (verse as { type?: unknown }).type === 'reference'
  );
}

/**
 * Render reference pointer lines in story order. Group refs are free pointers
 * and always render; channel refs are fetched only under `--resolve-cites`
 * and only while the command's shared budget lasts.
 */
export async function renderRefLines(
  refs: ContentReference[],
  { resolve, fetchRef, budget }: RenderRefLinesOptions
): Promise<string[]> {
  const lines: string[] = [];
  for (const ref of refs) {
    if (ref.referenceType === 'group') {
      if (typeof ref.groupId === 'string' && GROUP_ID_RE.test(ref.groupId)) {
        lines.push(`[ref: group ${ref.groupId}]`);
      }
      continue;
    }
    if (ref.referenceType !== 'channel') continue;
    if (!resolve || budget.remaining <= 0) continue;
    // Charged before the call: a failed fetch still spent its timeout.
    budget.remaining -= 1;
    try {
      const refPost = await fetchRef({
        channelId: ref.channelId,
        postId: ref.postId,
        replyId: ref.replyId,
      });
      const text = extractPostText(refPost?.content);
      if (text) {
        lines.push(text);
      }
    } catch {
      // A cite that can't be fetched is an expected miss.
    }
  }
  return lines;
}

// Everything a reader might treat as a line break, not just `\n`: the
// Unicode mandatory breaks (NEL, LS, PS) plus Python's `str.splitlines` set
// (VT, FF, and the FS/GS/RS separators -- hermes post-processes this output
// in Python). Any of these could otherwise smuggle an unframed logical line
// through the framing below.
const LINE_BREAK_RE = /\r\n|[\n\r\v\f\x1c\x1d\x1e\u0085\u2028\u2029]/;

// Per-line prefixes, not a single leading indent: the structural records
// (`- author @ time`, `  ID: …`, `  📎 …`) are themselves two-space indented,
// so an unprefixed continuation line of sender text could otherwise pass for
// one of them.
export function formatBodyLines(text: string): string[] {
  return text.split(LINE_BREAK_RE).map((line) => `  | ${line}`);
}

export function formatQuoteLines(text: string): string[] {
  return text.split(LINE_BREAK_RE).map((line) => `  > ${line}`);
}

/**
 * Collapse line separators in a sender-controlled value that is interpolated
 * into a single structural record line (blob filename, MIME type, URI,
 * transcription), so it cannot start a forged record on a line of its own.
 */
export function sanitizeInlineField(value: string): string {
  return value.replace(
    /(?:\r\n|[\n\r\v\f\x1c\x1d\x1e\u0085\u2028\u2029])+/g,
    ' '
  );
}

// Moved verbatim from messages.ts so the assembled record is testable.
export function formatTime(timeVal: string | number): string {
  try {
    const num = typeof timeVal === 'number' ? timeVal : parseInt(timeVal, 10);
    if (!isNaN(num) && num > 1600000000000) {
      const date = new Date(num);
      return date.toLocaleString();
    }
    const timeStr = String(timeVal);
    const daNum = BigInt(timeStr.replace(/\./g, ''));
    const DA_SECOND = BigInt('18446744073709551616');
    const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');
    const offset = DA_SECOND / BigInt(2000);
    const epochAdjusted = offset + (daNum - DA_UNIX_EPOCH);
    const unixMs = Math.round(
      Number((epochAdjusted * BigInt(1000)) / DA_SECOND)
    );

    const date = new Date(unixMs);
    if (date.getFullYear() > 2020 && date.getFullYear() < 2100) {
      return date.toLocaleString();
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function renderBlobLines(blob: Post['blob']): string[] {
  if (!blob) return [];
  const lines: string[] = [];
  try {
    const blobData: ClientPostBlobData = parsePostBlob(blob);
    // Blob string fields are sender-controlled and interpolated into single
    // record lines — collapse line separators so none can start a forged
    // record of its own.
    for (const entry of blobData) {
      if (entry.type === 'file') {
        lines.push(
          `  📎 [${sanitizeInlineField(entry.name || 'file')}] (${sanitizeInlineField(entry.mimeType || 'unknown')}, ${entry.size ? Math.round(entry.size / 1024) + 'KB' : '?'})`
        );
        if (entry.fileUri)
          lines.push(`     ${sanitizeInlineField(entry.fileUri)}`);
      } else if (entry.type === 'voicememo') {
        const dur = entry.duration ? `${Math.round(entry.duration)}s` : '?';
        lines.push(`  🎙️ [voice memo] (${dur})`);
        if (entry.transcription)
          lines.push(`     "${sanitizeInlineField(entry.transcription)}"`);
      } else if (entry.type === 'video') {
        lines.push(
          `  🎬 [${sanitizeInlineField(entry.name || 'video')}] (${sanitizeInlineField(entry.mimeType || 'video')})`
        );
      }
    }
  } catch {
    lines.push(`  [blob: ${sanitizeInlineField(blob.slice(0, 100))}...]`);
  }
  return lines;
}

export interface RenderPostOptions extends RenderRefLinesOptions {
  highlightId?: string;
}

/**
 * Assemble the complete printed record for one post: author line, ID line,
 * framed body, sanitized attachment lines, framed reference lines, and the
 * trailing blank separator. `messages.ts` prints these verbatim — keeping the
 * assembly here keeps the model-facing record shape under test.
 */
export async function renderPostLines(
  post: Post,
  opts: RenderPostOptions
): Promise<string[]> {
  const lines: string[] = [];
  const author = post.authorId || 'unknown';
  const time = formatTime(post.sentAt);
  const text = extractPostText(post.content);
  const replySuffix = post.parentId ? ` (reply to ${post.parentId})` : '';
  const marker =
    opts.highlightId && post.id === opts.highlightId ? ' ◀ TARGET' : '';

  lines.push(`- ${author} @ ${time}${replySuffix}${marker}`);
  lines.push(`  ID: ${post.id}`);
  if (text) {
    lines.push(...formatBodyLines(text));
  }
  lines.push(...renderBlobLines(post.blob));

  const refLines = await renderRefLines(extractReferences(post.content), opts);
  for (const ref of refLines) {
    lines.push(...formatQuoteLines(ref));
  }

  lines.push('');
  return lines;
}

export interface RenderPostListOptions {
  resolve: boolean;
  fetchRef: FetchRef;
  highlightId?: string;
  budget?: RefBudget;
}

/**
 * Render a batch of posts in sent order. Owns the per-command budget: one
 * allowance is created here for the whole batch unless the caller threads in
 * its own (`tlon messages post` shares one across the post and its replies),
 * so the resolution cap can't be reset per post.
 */
export async function renderPostListLines(
  posts: Post[],
  { resolve, fetchRef, highlightId, budget }: RenderPostListOptions
): Promise<string[]> {
  const sorted = [...posts].sort((a, b) => a.sentAt - b.sentAt);
  const shared = budget ?? createRefBudget();

  const lines: string[] = [];
  for (const post of sorted) {
    lines.push(
      ...(await renderPostLines(post, {
        resolve,
        fetchRef,
        budget: shared,
        highlightId,
      }))
    );
  }
  return lines;
}
