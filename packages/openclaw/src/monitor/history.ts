import type { ClientPostBlobData } from '@tloncorp/api';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import { formatBlobForHistory, parseBlobData } from './media.js';
import { extractMessageText } from './utils.js';

/**
 * Format a number as @ud (with dots every 3 digits from the right)
 * e.g., 170141184507799509469114119040828178432 -> 170.141.184.507.799.509.469.114.119.040.828.178.432
 */
function formatUd(id: string | number): string {
  const str = String(id).replace(/\./g, ''); // Remove any existing dots
  const reversed = str.split('').toReversed();
  const chunks: string[] = [];
  for (let i = 0; i < reversed.length; i += 3) {
    chunks.push(
      reversed
        .slice(i, i + 3)
        .toReversed()
        .join('')
    );
  }
  return chunks.toReversed().join('.');
}

export type TlonHistoryEntry = {
  author: string;
  content: string;
  timestamp: number;
  id?: string;
  blob?: string | null;
  parsedBlobData?: ClientPostBlobData | null;
};

export const MAX_THREAD_CONTEXT_MESSAGES = 20;

type ParentPostEssay = {
  author?: string | { ship?: string };
  content?: unknown;
  sent?: number;
};

type ParentPostSeal = {
  id?: string;
};

type ReplyMemo = ParentPostEssay & {
  blob?: string | null;
};

type ExactReplyScryResponse = {
  reply?: {
    memo?: ReplyMemo;
    'reply-essay'?: ReplyMemo;
    seal?: ParentPostSeal;
  };
  memo?: ReplyMemo;
  'reply-essay'?: ReplyMemo;
  seal?: ParentPostSeal;
};

function normalizeMessageId(id: string | number | undefined | null): string {
  const rawId = String(id ?? '');
  const separatorIndex = rawId.indexOf('/');
  const author = rawId.slice(0, separatorIndex);
  const bareId =
    separatorIndex > 0 && /^~?[a-z0-9-]+$/i.test(author)
      ? rawId.slice(separatorIndex + 1)
      : rawId;
  return bareId.replace(/\./g, '');
}

function getParsedBlobData(entry: TlonHistoryEntry): ClientPostBlobData | null {
  if (entry.parsedBlobData !== undefined) {
    return entry.parsedBlobData;
  }

  entry.parsedBlobData = parseBlobData(entry.blob);
  return entry.parsedBlobData;
}

/**
 * Render a history entry's full content for context display.
 * Combines text content with compact blob annotations (e.g. voice memo transcripts).
 */
export function renderHistoryContent(entry: TlonHistoryEntry): string {
  const parts: string[] = [];
  const blobData = getParsedBlobData(entry);
  if (blobData) {
    const blobText = formatBlobForHistory(blobData);
    if (blobText) parts.push(blobText);
  }
  if (entry.content) parts.push(entry.content);
  return parts.join('\n');
}

const messageCache = new Map<string, TlonHistoryEntry[]>();
const reactionTargetCache = new Map<string, TlonHistoryEntry[]>();
const MAX_CACHED_MESSAGES = 100;
const MAX_CACHED_REACTION_TARGETS = 20;
const REACTION_TARGET_FETCH_ATTEMPTS = 3;
const REACTION_TARGET_FETCH_RETRY_DELAY_MS = 50;

function findCachedMessage(
  cache: TlonHistoryEntry[] | undefined,
  messageId: string
): TlonHistoryEntry | undefined {
  if (!cache) return undefined;
  const normalizedId = normalizeMessageId(messageId);
  return cache.find(
    (entry) => entry.id && normalizeMessageId(entry.id) === normalizedId
  );
}

function removeCachedMessage(
  cache: TlonHistoryEntry[],
  messageId: string
): void {
  const normalizedId = normalizeMessageId(messageId);
  if (!normalizedId) return;

  const existingIndex = cache.findIndex(
    (entry) => normalizeMessageId(entry.id) === normalizedId
  );
  if (existingIndex >= 0) {
    cache.splice(existingIndex, 1);
  }
}

export function lookupCachedMessage(
  channelNest: string,
  messageId: string
): TlonHistoryEntry | undefined {
  return (
    findCachedMessage(messageCache.get(channelNest), messageId) ??
    findCachedMessage(reactionTargetCache.get(channelNest), messageId)
  );
}

/**
 * Resolve a channel post or reply for an event that can arrive before its echo.
 * Channel hosts assign the post id, so outbound client timestamps cannot be
 * used to pre-populate channel reaction-target lookup state.
 */
export async function lookupOrFetchCachedChannelMessage(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  messageId: string,
  rootPostId?: string,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry | undefined> {
  const cached = lookupCachedMessage(channelNest, messageId);
  if (cached) {
    return cached;
  }

  for (let attempt = 0; attempt < REACTION_TARGET_FETCH_ATTEMPTS; attempt++) {
    const fetched = rootPostId
      ? await fetchReplyHistoryEntry(
          api,
          channelNest,
          rootPostId,
          messageId,
          runtime
        )
      : await fetchParentPostHistoryEntry(api, channelNest, messageId, runtime);
    if (fetched?.author && fetched.author !== 'unknown') {
      const echoed = findCachedMessage(
        messageCache.get(channelNest),
        messageId
      );
      if (echoed) {
        return echoed;
      }
      cacheReactionTarget(channelNest, fetched);
      return fetched;
    }
    if (attempt < REACTION_TARGET_FETCH_ATTEMPTS - 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, REACTION_TARGET_FETCH_RETRY_DELAY_MS);
      });
    }
  }

  return undefined;
}

export function cacheMessage(channelNest: string, message: TlonHistoryEntry) {
  if (!messageCache.has(channelNest)) {
    messageCache.set(channelNest, []);
  }
  const cache = messageCache.get(channelNest);
  if (!cache) {
    return;
  }
  removeCachedMessage(cache, message.id ?? '');
  const targets = reactionTargetCache.get(channelNest);
  if (targets) {
    removeCachedMessage(targets, message.id ?? '');
    if (targets.length === 0) {
      reactionTargetCache.delete(channelNest);
    }
  }
  cache.unshift(message);
  if (cache.length > MAX_CACHED_MESSAGES) {
    cache.pop();
  }
}

function cacheReactionTarget(
  channelNest: string,
  message: TlonHistoryEntry
): void {
  if (!reactionTargetCache.has(channelNest)) {
    reactionTargetCache.set(channelNest, []);
  }
  const cache = reactionTargetCache.get(channelNest);
  if (!cache) {
    return;
  }

  removeCachedMessage(cache, message.id ?? '');
  cache.unshift(message);
  if (cache.length > MAX_CACHED_REACTION_TARGETS) {
    cache.pop();
  }
}

export async function fetchChannelHistory(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  count = 50,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry[]> {
  try {
    const scryPath = `/channels/v4/${channelNest}/posts/newest/${count}/outline.json`;
    runtime?.log?.(`[tlon] Fetching history: ${scryPath}`);

    const data: any = await api.scry(scryPath);
    if (!data) {
      return [];
    }

    let posts: any[] = [];
    if (Array.isArray(data)) {
      posts = data;
    } else if (data.posts && typeof data.posts === 'object') {
      posts = Object.values(data.posts);
    } else if (typeof data === 'object') {
      posts = Object.values(data);
    }

    const messages = posts
      .map((item) => {
        const essay = item.essay || item['r-post']?.set?.essay;
        const seal = item.seal || item['r-post']?.set?.seal;

        return {
          author: essay?.author || 'unknown',
          content: extractMessageText(essay?.content || []),
          timestamp: essay?.sent || Date.now(),
          id: seal?.id,
          blob: essay?.blob ?? null,
        } as TlonHistoryEntry;
      })
      .filter((msg) => msg.content || msg.blob);

    runtime?.log?.(`[tlon] Extracted ${messages.length} messages from history`);
    return messages;
  } catch (error: any) {
    runtime?.log?.(
      `[tlon] Error fetching channel history: ${error?.message ?? String(error)}`
    );
    return [];
  }
}

export async function getChannelHistory(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  count = 50,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry[]> {
  const cache = messageCache.get(channelNest) ?? [];
  if (cache.length >= count) {
    runtime?.log?.(`[tlon] Using cached messages (${cache.length} available)`);
    return cache.slice(0, count);
  }

  runtime?.log?.(
    `[tlon] Cache has ${cache.length} messages, need ${count}, fetching from scry...`
  );
  return await fetchChannelHistory(api, channelNest, count, runtime);
}

/**
 * Fetch thread/reply history for a specific parent post.
 * Used to get context when entering a thread conversation.
 */
export async function fetchThreadHistory(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  parentId: string,
  count = 50,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry[]> {
  try {
    // Tlon API: fetch replies to a specific post
    // Format: /channels/v4/{nest}/posts/post/{parentId}/replies/newest/{count}.json
    // parentId needs @ud formatting (dots every 3 digits)
    const formattedParentId = formatUd(parentId);
    runtime?.log?.(
      `[tlon] Thread history - parentId: ${parentId} -> formatted: ${formattedParentId}`
    );

    const scryPath = `/channels/v4/${channelNest}/posts/post/id/${formattedParentId}/replies/newest/${count}.json`;
    runtime?.log?.(`[tlon] Fetching thread history: ${scryPath}`);

    const data: any = await api.scry(scryPath);
    if (!data) {
      runtime?.log?.(`[tlon] No thread history data returned`);
      return [];
    }

    let replies: any[] = [];
    if (Array.isArray(data)) {
      replies = data;
    } else if (data.replies && Array.isArray(data.replies)) {
      replies = data.replies;
    } else if (typeof data === 'object') {
      replies = Object.values(data);
    }

    const messages = replies
      .map((item) => {
        // Thread replies use 'memo' structure
        const memo = item.memo || item['r-reply']?.set?.memo || item;
        const seal = item.seal || item['r-reply']?.set?.seal;

        return {
          author: memo?.author || 'unknown',
          content: extractMessageText(memo?.content || []),
          timestamp: memo?.sent || Date.now(),
          id: seal?.id || item.id,
          blob: memo?.blob ?? null,
        } as TlonHistoryEntry;
      })
      .filter((msg) => msg.content || msg.blob);

    runtime?.log?.(
      `[tlon] Extracted ${messages.length} thread replies from history`
    );
    return messages;
  } catch (error: any) {
    runtime?.log?.(
      `[tlon] Error fetching thread history: ${error?.message ?? String(error)}`
    );
    // Fall back to trying alternate path structure
    try {
      const altPath = `/channels/v4/${channelNest}/posts/post/id/${formatUd(parentId)}.json`;
      runtime?.log?.(`[tlon] Trying alternate path: ${altPath}`);
      const data: any = await api.scry(altPath);

      if (data?.seal?.meta?.replyCount > 0 && data?.replies) {
        const replies = Array.isArray(data.replies)
          ? data.replies
          : Object.values(data.replies);
        const messages = replies
          .map((reply: any) => ({
            author: reply.memo?.author || 'unknown',
            content: extractMessageText(reply.memo?.content || []),
            timestamp: reply.memo?.sent || Date.now(),
            id: reply.seal?.id,
            blob: reply.memo?.blob ?? null,
          }))
          .filter((msg: TlonHistoryEntry) => msg.content || msg.blob);

        runtime?.log?.(
          `[tlon] Extracted ${messages.length} replies from post data`
        );
        return messages;
      }
    } catch (altError: any) {
      runtime?.log?.(
        `[tlon] Alternate path also failed: ${altError?.message ?? String(altError)}`
      );
    }
    return [];
  }
}

async function fetchParentPost(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  parentId: string,
  runtime?: RuntimeEnv
): Promise<{ essay: ParentPostEssay; seal?: ParentPostSeal } | null> {
  try {
    // Mirrors resolveCiteContent: channels +on-peek matches `[%post time=@ ~]`, mark goes in `.json` extension.
    const scryPath = `/channels/v4/${channelNest}/posts/post/${formatUd(parentId)}.json`;
    runtime?.log?.(`[tlon] Fetching parent post: ${scryPath}`);
    const data: any = await api.scry(scryPath);

    const post = data?.post ?? data;
    const essay = post?.essay || post?.memo || post?.['r-post']?.set?.essay;
    const seal = post?.seal || post?.['r-post']?.set?.seal;
    return essay ? { essay, seal } : null;
  } catch (error: any) {
    runtime?.log?.(
      `[tlon] Error fetching parent post: ${error?.message ?? String(error)}`
    );
    return null;
  }
}

async function fetchReplyHistoryEntry(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  rootPostId: string,
  replyId: string,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry | null> {
  try {
    const scryPath = `/channels/v4/${channelNest}/posts/post/id/${formatUd(rootPostId)}/replies/reply/id/${formatUd(replyId)}.json`;
    runtime?.log?.(`[tlon] Fetching reply: ${scryPath}`);
    const data = (await api.scry(scryPath)) as ExactReplyScryResponse | null;
    const reply = data?.reply ?? data;
    const memo = reply?.memo ?? reply?.['reply-essay'];
    if (!memo) {
      return null;
    }

    return {
      author: parentPostAuthor(memo) ?? 'unknown',
      content: extractMessageText(memo.content || []),
      timestamp: memo.sent || Date.now(),
      id: reply?.seal?.id || replyId,
      blob: memo.blob ?? null,
    };
  } catch (error: any) {
    runtime?.log?.(
      `[tlon] Error fetching reply: ${error?.message ?? String(error)}`
    );
    return null;
  }
}

function parentPostAuthor(essay?: ParentPostEssay): string | null {
  if (typeof essay?.author === 'string') {
    return essay.author;
  }
  if (typeof essay?.author?.ship === 'string') {
    return essay.author.ship;
  }
  return null;
}

/**
 * Fetch a parent post's author without requiring text content.
 */
export async function fetchParentPostAuthor(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  parentId: string,
  runtime?: RuntimeEnv
): Promise<string | null> {
  const parentPost = await fetchParentPost(api, channelNest, parentId, runtime);
  return parentPostAuthor(parentPost?.essay);
}

/**
 * Fetch the parent post body for a thread.
 */
export async function fetchParentPostHistoryEntry(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  parentId: string,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry | null> {
  const parentPost = await fetchParentPost(api, channelNest, parentId, runtime);
  if (!parentPost) {
    return null;
  }

  const { essay, seal } = parentPost;
  const content = extractMessageText(essay.content || []);
  if (!content) {
    runtime?.log?.(`[tlon] Parent post has no text content: ${parentId}`);
  }

  const author = parentPostAuthor(essay) ?? 'unknown';

  return {
    author,
    content,
    timestamp: essay.sent || Date.now(),
    id: seal?.id || parentId,
  };
}

export function retainThreadContextMessages(
  threadContextHistory: TlonHistoryEntry[],
  maxMessages = MAX_THREAD_CONTEXT_MESSAGES
): TlonHistoryEntry[] {
  if (threadContextHistory.length <= maxMessages) {
    return threadContextHistory;
  }
  return [
    threadContextHistory[0],
    ...threadContextHistory.slice(-(maxMessages - 1)),
  ];
}

export function buildThreadContextMessage(
  threadContextHistory: TlonHistoryEntry[],
  currentMessageText: string,
  opts: {
    formatAuthor: (author: string) => string;
    sanitizeContent: (content: string) => string;
    maxMessages?: number;
  }
): { messageText: string; contextMessages: TlonHistoryEntry[] } | null {
  if (threadContextHistory.length === 0) {
    return null;
  }

  const contextMessages = retainThreadContextMessages(
    threadContextHistory,
    opts.maxMessages ?? MAX_THREAD_CONTEXT_MESSAGES
  );
  const threadContext = contextMessages
    .map(
      (msg) =>
        `${opts.formatAuthor(msg.author)}: ${opts.sanitizeContent(renderHistoryContent(msg))}`
    )
    .join('\n');
  const contextNote = `[Thread conversation - ${contextMessages.length} messages including the parent post. You are participating in this thread. Only respond if relevant or helpful - you don't need to reply to every message.]`;
  return {
    messageText:
      `${contextNote}\n\n[Previous messages]\n${threadContext}\n\n` +
      `[Current message]\n${currentMessageText}`,
    contextMessages,
  };
}

/**
 * Assemble complete thread context with parent post first, then replies.
 */
export async function fetchThreadContextHistory(
  api: { scry: (path: string) => Promise<unknown> },
  channelNest: string,
  parentId: string,
  count = 50,
  runtime?: RuntimeEnv
): Promise<TlonHistoryEntry[]> {
  const [parentPost, replies] = await Promise.all([
    fetchParentPostHistoryEntry(api, channelNest, parentId, runtime),
    fetchThreadHistory(api, channelNest, parentId, count, runtime),
  ]);

  const ordered = [parentPost, ...replies].filter(
    (entry): entry is TlonHistoryEntry => Boolean(entry)
  );
  const seen = new Set<string>();
  const deduped: TlonHistoryEntry[] = [];

  for (const entry of ordered) {
    const key = entry.id
      ? normalizeMessageId(entry.id)
      : `${entry.author}:${entry.timestamp}:${entry.content}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}
