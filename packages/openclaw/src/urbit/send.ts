import {
  addReaction as apiAddReaction,
  deletePost as apiDeletePost,
  getChannelPosts as apiGetChannelPosts,
  getPostWithReplies as apiGetPostWithReplies,
  getTextContent,
  removeReaction as apiRemoveReaction,
  sendPost as apiSendPost,
  sendReply as apiSendReply,
} from '@tloncorp/api';
import { da, scot } from '@urbit/aura';

import { reportReplyOutput } from '../telemetry.js';
import { claimActiveTlonTurnOutput } from '../turn-recorder.js';
import {
  type RoleMentionScope,
  type Story,
  createImageBlock,
  markdownToStory,
} from './story.js';

// --- Helpers ---

/**
 * Format a post ID as @ud (with dots) if it's a bare digit string.
 * Tlon requires @ud-formatted IDs for post references.
 */
function formatPostId(postId: string): string {
  if (/^\d+$/.test(postId)) {
    try {
      return scot('ud', BigInt(postId));
    } catch {
      // fall through
    }
  }
  return postId;
}

/**
 * Parse a writ-id string into author and bare ID components.
 * Writ-ids look like "~sampel-palnet/170.141.184..." (author/udId).
 * Returns the components for use with @tloncorp/api which expects them separately.
 */
function parseWritId(id: string): { author: string; bareId: string } {
  if (id.includes('/') && id.startsWith('~')) {
    const idx = id.indexOf('/');
    return { author: id.slice(0, idx), bareId: id.slice(idx + 1) };
  }
  return { author: '', bareId: id };
}

function reportSuccessfulSend<T extends { messageId: string; sentAt: number }>(
  result: T,
  chatType: 'dm' | 'groupChannel',
  isThreadReply: boolean
): T {
  try {
    const turn = claimActiveTlonTurnOutput();
    reportReplyOutput({
      messageId: result.messageId,
      sentAt: result.sentAt,
      runId: turn.runId,
      traceId: turn.traceId,
      outputIndex: turn.outputIndex,
      chatType,
      isThreadReply,
    });
  } catch {
    // Telemetry must never change delivery behavior.
  }
  return result;
}

function reportSuccessfulChannelSend<
  T extends { messageId: string; sentAt: number },
>(result: T, nest: string, isThreadReply: boolean): T {
  return nest.startsWith('chat/')
    ? reportSuccessfulSend(result, 'groupChannel', isThreadReply)
    : result;
}

/**
 * Compute a @ud-formatted timestamp for building message IDs.
 *
 * Exported so cross-repo fixture tests can pin the message-id encoding
 * against this exact function — see `src/urbit/send.fixtures.test.ts` and
 * `homestead/packages/shared/src/api/__tests__/dmTapTelemetryRoundTrip.test.ts`.
 */
export function formatSentAt(sentAt: number): string {
  return scot('ud', da.fromUnix(sentAt));
}

// Date.now() is millisecond-resolution, so two sends in the same millisecond
// by the same author would be told apart by nothing: a DM writ's id is
// author/sent, and a channel post is read back by author and sent time. One
// clock per process hands out strictly increasing sent times instead.
let lastSentAt = 0;
function uniqueSentAt(): number {
  const now = Date.now();
  lastSentAt = now > lastSentAt ? now : lastSentAt + 1;
  return lastSentAt;
}

// --- DMs ---

/** Optional bot profile for custom display name/avatar */
export type BotProfile = {
  // Use empty string instead of undefined to ensure consistent serialization
  nickname: string;
  avatar: string;
};

type SendTextParams = {
  fromShip: string;
  toShip: string;
  text: string;
  blob?: string;
  replyToId?: string | null;
  parentAuthor?: string;
  botProfile?: BotProfile;
  /** Opt in to `@all`/role conversion; only for model-authored text. */
  roleMentions?: RoleMentionScope;
};

type SendStoryParams = {
  fromShip: string;
  toShip: string;
  story: Story;
  blob?: string;
  replyToId?: string | null;
  parentAuthor?: string;
  botProfile?: BotProfile;
};

export async function sendDm({ roleMentions, ...params }: SendTextParams) {
  const story: Story = markdownToStory(params.text, { roleMentions });
  return sendDmWithStory({ ...params, story });
}

export async function sendDmWithStory({
  fromShip,
  toShip,
  story,
  blob,
  replyToId,
  parentAuthor,
  botProfile,
}: SendStoryParams) {
  const sentAt = uniqueSentAt();
  const messageId = `${fromShip}/${formatSentAt(sentAt)}`;

  if (replyToId) {
    const parsed = parseWritId(replyToId);
    const effectiveAuthor = parentAuthor || parsed.author || toShip;
    const bareParentId = formatPostId(parsed.bareId);

    await apiSendReply({
      channelId: toShip,
      parentId: bareParentId,
      parentAuthor: effectiveAuthor,
      content: story,
      sentAt,
      authorId: fromShip,
      blob,
      botProfile,
    });
    return reportSuccessfulSend(
      { channel: 'tlon' as const, messageId, sentAt },
      'dm',
      true
    );
  }

  await apiSendPost({
    channelId: toShip,
    authorId: fromShip,
    sentAt,
    content: story,
    blob,
    botProfile,
  });
  return reportSuccessfulSend(
    { channel: 'tlon' as const, messageId, sentAt },
    'dm',
    false
  );
}

// --- Channel posts (chat, heap, diary) ---

// A channel post's id is the time the host received it, which the sender
// can't know when it pokes: the sent time it chose is only the app's cache
// key. The host's id is what edits, deletes and reactions take, so after the
// poke the post is read back by author and sent time. A self-hosted channel
// has it at once; a remote host echoes it within a round trip.
const POST_ID_LOOKUP_ATTEMPTS = 8;
const POST_ID_LOOKUP_DELAY_MS = 250;

function isSameShip(a: string | null | undefined, b: string): boolean {
  return !!a && a.replace(/^~/, '') === b.replace(/^~/, '');
}

async function findHostPostId(
  nest: string,
  fromShip: string,
  sentAt: number,
  text: string,
  parentId: string | undefined
): Promise<string | undefined> {
  if (parentId) {
    const parent = await apiGetPostWithReplies({
      channelId: nest,
      postId: parentId,
      // Only DM lookups read the author; channel posts are found by nest and id.
      authorId: '',
    });
    return onlyMatch(parent.replies ?? [], fromShip, sentAt, text);
  }
  const { posts } = await apiGetChannelPosts({
    channelId: nest,
    mode: 'newest',
    count: 20,
    skipGapFill: true,
  });
  return onlyMatch(posts, fromShip, sentAt, text);
}

// The post is ours only if it carries this author, this sent time and the
// text we sent, and only one post does. The clock above keeps this process's
// sent times apart, but the bot's CLI subprocess sends as the same ship on its
// own clock, and the channels agent drops the second add it sees for a
// (nest, sent) pair: the lone post with our sent time may then be the other
// send's, and naming it would point a later edit or delete at it.
function onlyMatch(
  posts: Array<{
    id: string;
    authorId?: string | null;
    sentAt?: number | null;
    textContent?: string | null;
  }>,
  fromShip: string,
  sentAt: number,
  text: string
): string | undefined {
  const matches = posts.filter(
    (post) =>
      post.sentAt === sentAt &&
      isSameShip(post.authorId, fromShip) &&
      sameText(post.textContent, text)
  );
  return matches.length === 1 ? matches[0].id : undefined;
}

// The stored text and ours come from the same extractor under different
// layout settings (block separators, line breaks), so compare them with
// whitespace collapsed.
function sameText(stored: string | null | undefined, sent: string): boolean {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
  return norm(stored ?? '') === norm(sent);
}

// The message was sent before this runs, so a lookup that never finds it
// cannot fail the send (the caller would resend): it falls back to the sent
// time id, which is what every send returned before the lookup existed.
async function resolveChannelPostId(
  nest: string,
  fromShip: string,
  sentAt: number,
  story: Story,
  parentId?: string
): Promise<string> {
  const text = getTextContent(story) ?? '';
  for (let attempt = 0; attempt < POST_ID_LOOKUP_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, POST_ID_LOOKUP_DELAY_MS)
      );
    }
    try {
      const id = await findHostPostId(nest, fromShip, sentAt, text, parentId);
      if (id) return id;
    } catch {
      // Not readable yet, or not at all; the next attempt or the fallback.
    }
  }
  return formatSentAt(sentAt);
}

type SendChannelPostParams = {
  fromShip: string;
  /** Full nest like "chat/~host/channel", "heap/~host/channel", or "diary/~host/channel" */
  nest: string;
  story: Story;
  blob?: string;
  replyToId?: string | null;
  /** Optional title for heap/diary posts */
  title?: string;
  /** Optional bot profile for custom display name/avatar */
  botProfile?: BotProfile;
};

/**
 * Unified function for posting to any channel type (chat, heap, diary).
 * Takes a full nest string directly.
 */
export async function sendChannelPost({
  fromShip,
  nest,
  story,
  blob,
  replyToId,
  title,
  botProfile,
}: SendChannelPostParams) {
  const sentAt = uniqueSentAt();

  if (replyToId) {
    const formattedReplyId = formatPostId(replyToId);
    await apiSendReply({
      channelId: nest,
      parentId: formattedReplyId,
      parentAuthor: '', // Not used for channel replies
      content: story,
      sentAt,
      authorId: fromShip,
      blob,
      botProfile,
    });
    return reportSuccessfulChannelSend(
      {
        channel: 'tlon',
        messageId: `${fromShip}/${await resolveChannelPostId(nest, fromShip, sentAt, story, formattedReplyId)}`,
        sentAt,
      },
      nest,
      true
    );
  }

  await apiSendPost({
    channelId: nest,
    authorId: fromShip,
    sentAt,
    content: story,
    metadata: title ? { title } : undefined,
    blob,
    botProfile,
  });
  return reportSuccessfulChannelSend(
    {
      channel: 'tlon',
      messageId: `${fromShip}/${await resolveChannelPostId(nest, fromShip, sentAt, story)}`,
      sentAt,
    },
    nest,
    false
  );
}

// --- Utilities ---

export function buildMediaText(
  text: string | undefined,
  mediaUrl: string | undefined
): string {
  const cleanText = text?.trim() ?? '';
  const cleanUrl = mediaUrl?.trim() ?? '';
  if (cleanText && cleanUrl) {
    return `${cleanText}\n${cleanUrl}`;
  }
  if (cleanUrl) {
    return cleanUrl;
  }
  return cleanText;
}

/**
 * Build a story with text and optional media (image or link)
 */
export function buildMediaStory(
  text: string | undefined,
  media: { url: string; isImage: boolean } | undefined,
  options: { roleMentions?: RoleMentionScope } = {}
): Story {
  const story: Story = [];
  const cleanText = text?.trim() ?? '';

  if (cleanText) {
    story.push(...markdownToStory(cleanText, options));
  }

  if (media) {
    if (media.isImage) {
      story.push(createImageBlock(media.url, ''));
    } else {
      story.push({
        inline: [{ link: { href: media.url, content: media.url } }],
      });
    }
  }

  return story.length > 0 ? story : [{ inline: [''] }];
}

// --- Reactions ---

type ChannelReactParams = {
  fromShip: string;
  hostShip: string;
  channelName: string;
  postId: string;
  react: string;
  nestPrefix?: string;
  parentId?: string;
};

export async function addChannelReaction({
  fromShip,
  hostShip,
  channelName,
  postId,
  react,
  nestPrefix = 'chat',
  parentId,
}: ChannelReactParams) {
  const nest = `${nestPrefix}/${hostShip}/${channelName}`;
  const formattedPostId = formatPostId(postId);

  await apiAddReaction({
    channelId: nest,
    postId: formattedPostId,
    emoji: react,
    our: fromShip,
    postAuthor: fromShip, // Not used for channel reactions
    ...(parentId && { parentId: formatPostId(parentId) }),
  });
}

export async function removeChannelReaction({
  fromShip,
  hostShip,
  channelName,
  postId,
  nestPrefix = 'chat',
  parentId,
}: Omit<ChannelReactParams, 'react'>) {
  const nest = `${nestPrefix}/${hostShip}/${channelName}`;
  const formattedPostId = formatPostId(postId);

  await apiRemoveReaction({
    channelId: nest,
    postId: formattedPostId,
    our: fromShip,
    postAuthor: fromShip, // Not used for channel reactions
    ...(parentId && { parentId: formatPostId(parentId) }),
  });
}

type DmReactParams = {
  fromShip: string;
  toShip: string;
  messageId: string;
  react: string;
  parentId?: string;
  postAuthor?: string;
  parentAuthor?: string;
};

export async function addDmReaction({
  fromShip,
  toShip,
  messageId,
  react,
  parentId,
  postAuthor,
  parentAuthor,
}: DmReactParams) {
  const parsedMessage = parseWritId(messageId);
  const effectivePostAuthor = postAuthor || parsedMessage.author || toShip;
  const formattedPostId = formatPostId(parsedMessage.bareId);

  if (parentId) {
    const parsedParent = parseWritId(parentId);
    const effectiveParentAuthor = parentAuthor || parsedParent.author || toShip;
    const formattedParentId = formatPostId(parsedParent.bareId);

    await apiAddReaction({
      channelId: toShip,
      postId: formattedPostId,
      emoji: react,
      our: fromShip,
      postAuthor: effectivePostAuthor,
      parentId: formattedParentId,
      parentAuthorId: effectiveParentAuthor,
    });
    return;
  }

  await apiAddReaction({
    channelId: toShip,
    postId: formattedPostId,
    emoji: react,
    our: fromShip,
    postAuthor: effectivePostAuthor,
  });
}

export async function removeDmReaction({
  fromShip,
  toShip,
  messageId,
  parentId,
  postAuthor,
  parentAuthor,
}: Omit<DmReactParams, 'react'>) {
  const parsedMessage = parseWritId(messageId);
  const effectivePostAuthor = postAuthor || parsedMessage.author || toShip;
  const formattedPostId = formatPostId(parsedMessage.bareId);

  if (parentId) {
    const parsedParent = parseWritId(parentId);
    const effectiveParentAuthor = parentAuthor || parsedParent.author || toShip;
    const formattedParentId = formatPostId(parsedParent.bareId);

    await apiRemoveReaction({
      channelId: toShip,
      postId: formattedPostId,
      our: fromShip,
      postAuthor: effectivePostAuthor,
      parentId: formattedParentId,
      parentAuthorId: effectiveParentAuthor,
    });
    return;
  }

  await apiRemoveReaction({
    channelId: toShip,
    postId: formattedPostId,
    our: fromShip,
    postAuthor: effectivePostAuthor,
  });
}
// --- Delete ---

type DeleteHeapPostParams = {
  hostShip: string;
  channelName: string;
  curioId: string;
};

export async function deleteHeapPost({
  hostShip,
  channelName,
  curioId,
}: DeleteHeapPostParams) {
  const nest = `heap/${hostShip}/${channelName}`;
  const formattedCurioId = formatPostId(curioId);

  await apiDeletePost(nest, formattedCurioId, '');

  return { ok: true };
}
