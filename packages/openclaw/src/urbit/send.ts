import {
  addReaction as apiAddReaction,
  deletePost as apiDeletePost,
  removeReaction as apiRemoveReaction,
  sendPost as apiSendPost,
  sendReply as apiSendReply,
  sendVouchedDm as apiSendVouchedDm,
} from '@tloncorp/api';
import { da, scot } from '@urbit/aura';

import {
  type Story,
  createImageBlock,
  isImageUrl,
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

export async function sendDm(params: SendTextParams) {
  const story: Story = markdownToStory(params.text);
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
  const sentAt = Date.now();
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
    return { channel: 'tlon' as const, messageId, sentAt };
  }

  await apiSendPost({
    channelId: toShip,
    authorId: fromShip,
    sentAt,
    content: story,
    blob,
    botProfile,
  });
  return { channel: 'tlon' as const, messageId, sentAt };
}

// --- Vouched DMs (virtual identity / moon) ---

/**
 * Send a DM authored as a moon (`as`) via the vouched path. The host (the
 * moon's sponsor) vouches for it, and the message is filed under the
 * [moon, human] conversation on both ends. Top-level only for now (no
 * thread replies).
 */
export async function sendVouchedDm(params: {
  as: string;
  toShip: string;
  text: string;
  blob?: string;
  botProfile?: BotProfile;
}) {
  return sendVouchedDmWithStory({
    ...params,
    story: markdownToStory(params.text),
  });
}

export async function sendVouchedDmWithStory({
  as,
  toShip,
  story,
  blob,
  botProfile,
}: {
  as: string;
  toShip: string;
  story: Story;
  blob?: string;
  botProfile?: BotProfile;
}) {
  const sentAt = Date.now();
  const result = await apiSendVouchedDm({
    as,
    // the host authors as its own moon
    authorId: as,
    toShip,
    content: story,
    sentAt,
    blob,
    botProfile,
  });
  return { channel: 'tlon' as const, messageId: result.messageId, sentAt };
}

// --- Channel posts (chat, heap, diary) ---

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
  const sentAt = Date.now();

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
    return {
      channel: 'tlon',
      messageId: `${fromShip}/${formatSentAt(sentAt)}`,
    };
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
  return {
    channel: 'tlon',
    messageId: `${fromShip}/${formatSentAt(sentAt)}`,
  };
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
 * Build a story with text and optional media (image)
 */
export function buildMediaStory(
  text: string | undefined,
  mediaUrl: string | undefined
): Story {
  const story: Story = [];
  const cleanText = text?.trim() ?? '';
  const cleanUrl = mediaUrl?.trim() ?? '';

  // Add text content if present
  if (cleanText) {
    story.push(...markdownToStory(cleanText));
  }

  // Add image block if URL looks like an image
  if (cleanUrl && isImageUrl(cleanUrl)) {
    story.push(createImageBlock(cleanUrl, ''));
  } else if (cleanUrl) {
    // For non-image URLs, add as a link
    story.push({ inline: [{ link: { href: cleanUrl, content: cleanUrl } }] });
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
