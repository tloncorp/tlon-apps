import * as api from '@tloncorp/api';
import type {
  BotReplyFeedbackEntry,
  BotReplyFeedbackRating,
  BotReplyFeedbackSetting,
} from '@tloncorp/api';
import type {
  TlonbotReplyFeedbackChanged,
  TlonbotReplyFeedbackConversationExcerptItem,
  TlonbotReplyFeedbackDetailsSubmitted,
} from '@tloncorp/api/types/analytics';
import { AnalyticsEvent } from '@tloncorp/api/types/analytics';
import { v4 as uuidv4 } from 'uuid';

import * as db from '../db';
import * as logic from '../logic';

const REPLY_TEXT_LIMIT = 2_000;
const EXCERPT_MESSAGE_LIMIT = 8;
const EXCERPT_TEXT_LIMIT = 500;
const EMAIL_PATTERN = /(?:mailto:)?\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LINK_PATTERN =
  /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>()]+[^\s<>().,!?;:'"]/gi;
const AT_MENTION_PATTERN = /(^|[^A-Za-z0-9_])@[A-Za-z0-9][A-Za-z0-9._-]*/g;
const SHIP_MENTION_PATTERN = /(^|[^A-Za-z0-9_])~[a-z][a-z-]{2,}/g;
export const BOT_REPLY_FEEDBACK_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

export type MandatoryEventCapture = (event: {
  eventId: string;
  properties?: Record<string, unknown>;
}) => Promise<void> | void;

export function getBotReplyMessageId(post: Pick<db.Post, 'authorId' | 'id'>) {
  return `${post.authorId}/${post.id}`;
}

export function getPostIdFromBotReplyMessageId(messageId: string) {
  return messageId.slice(messageId.lastIndexOf('/') + 1);
}

function truncate(text: string | null | undefined, limit: number) {
  return (text ?? '').slice(0, limit);
}

// Sanitize only the message copies sent with feedback telemetry. Local message
// content remains unchanged, and intentionally submitted feedback details are
// kept verbatim.
export function sanitizeBotReplyFeedbackText(text: string | null | undefined) {
  return (text ?? '')
    .replace(EMAIL_PATTERN, '[email]')
    .replace(LINK_PATTERN, '[link]')
    .replace(AT_MENTION_PATTERN, '$1[mention]')
    .replace(SHIP_MENTION_PATTERN, '$1[mention]');
}

function sanitizeAndTruncate(text: string | null | undefined, limit: number) {
  return truncate(sanitizeBotReplyFeedbackText(text), limit);
}

function toCachedEntry(
  postId: string,
  messageId: string,
  entry: BotReplyFeedbackEntry
): db.BotReplyFeedback {
  return { postId, messageId, ...entry };
}

export function toCachedBotReplyFeedback(
  entry: BotReplyFeedbackSetting
): db.BotReplyFeedback {
  return toCachedEntry(
    getPostIdFromBotReplyMessageId(entry.messageId),
    entry.messageId,
    entry
  );
}

export function getFreshBotReplyFeedback(
  entries: BotReplyFeedbackSetting[],
  now = Date.now()
) {
  const cutoff = now - BOT_REPLY_FEEDBACK_RETENTION_MS;
  return entries.filter((entry) => entry.submittedAt >= cutoff);
}

async function getFeedbackAnalyticsContext(post: db.Post) {
  const channel = await db.getChannel({ id: post.channelId });
  const group = channel?.groupId
    ? await db.getGroup({ id: channel.groupId })
    : null;
  return {
    channel,
    common: {
      messageId: getBotReplyMessageId(post),
      botShip: post.authorId,
      replySentAt: post.sentAt,
      isThreadReply: post.parentId != null,
      channelType: channel?.type ?? null,
      isBotDm: logic.isBotDmChannel({ post, channel }),
      ...logic.getModelAnalytics({ post, channel, group }),
    },
  };
}

export async function buildBotReplyConversationExcerpt(
  post: db.Post,
  currentUserId: string
): Promise<TlonbotReplyFeedbackConversationExcerptItem[]> {
  const posts = await db.getBotReplyConversationExcerptPosts({
    channelId: post.channelId,
    parentId: post.parentId ?? null,
    sentAt: post.sentAt,
    limit: EXCERPT_MESSAGE_LIMIT * 2,
  });

  return posts
    .filter(
      (candidate) =>
        candidate.authorId === currentUserId ||
        candidate.authorId === post.authorId
    )
    .slice(-EXCERPT_MESSAGE_LIMIT)
    .map((candidate) => ({
      authorType:
        candidate.authorId === currentUserId
          ? 'user'
          : candidate.authorId === post.authorId
            ? 'bot'
            : 'other',
      sentAt: candidate.sentAt,
      text: sanitizeAndTruncate(candidate.textContent, EXCERPT_TEXT_LIMIT),
    }));
}

async function persistFeedbackEntry(
  post: db.Post,
  entry: BotReplyFeedbackEntry
) {
  const messageId = getBotReplyMessageId(post);
  const previous = await db.getBotReplyFeedback(messageId);
  await db.upsertBotReplyFeedback(toCachedEntry(post.id, messageId, entry));
  try {
    await api.setBotReplyFeedback(messageId, entry);
  } catch (error) {
    if (previous) {
      await db.upsertBotReplyFeedback(previous);
    } else {
      await db.deleteBotReplyFeedback(messageId);
    }
    throw error;
  }
}

export async function changeBotReplyFeedback({
  post,
  action,
  rating,
  captureMandatoryEvent,
}: {
  post: db.Post;
  action: 'set' | 'clear';
  rating?: BotReplyFeedbackRating;
  captureMandatoryEvent: MandatoryEventCapture;
}) {
  if (action === 'set' && !rating) {
    throw new Error('A rating is required when setting bot reply feedback');
  }

  const messageId = getBotReplyMessageId(post);
  const current = await api.getBotReplyFeedback(messageId);
  const clientEventAt = Date.now();
  const next: BotReplyFeedbackEntry = {
    feedbackId: current?.feedbackId ?? uuidv4(),
    revision: (current?.revision ?? 0) + 1,
    rating: action === 'set' ? rating! : null,
    categories: [],
    submittedAt: clientEventAt,
  };

  await persistFeedbackEntry(post, next);
  const { common } = await getFeedbackAnalyticsContext(post);
  const properties: TlonbotReplyFeedbackChanged & Record<string, unknown> = {
    ...common,
    feedbackId: next.feedbackId,
    revision: next.revision,
    clientEventAt,
    action,
    ...(action === 'set' ? { rating } : {}),
  };
  try {
    await captureMandatoryEvent({
      eventId: AnalyticsEvent.TlonbotReplyFeedbackChanged,
      properties,
    });
  } catch (error) {
    // The ship-synced vote is already durable; a telemetry transport failure
    // must not make the UI treat the vote itself as lost.
    console.error('Failed to capture bot reply feedback change', error);
  }
  return next;
}

export async function submitBotReplyFeedbackDetails({
  post,
  rating,
  categories,
  details,
  currentUserId,
  captureMandatoryEvent,
}: {
  post: db.Post;
  rating: BotReplyFeedbackRating;
  categories: string[];
  details: string;
  currentUserId: string;
  captureMandatoryEvent: MandatoryEventCapture;
}) {
  const messageId = getBotReplyMessageId(post);
  const current = await api.getBotReplyFeedback(messageId);
  if (!current || current.rating !== rating) {
    throw new Error('The bot reply rating changed before details were saved');
  }

  const clientEventAt = Date.now();
  const next: BotReplyFeedbackEntry = {
    ...current,
    revision: current.revision + 1,
    categories,
    submittedAt: clientEventAt,
  };
  await persistFeedbackEntry(post, next);

  const [{ common }, conversationExcerpt] = await Promise.all([
    getFeedbackAnalyticsContext(post),
    buildBotReplyConversationExcerpt(post, currentUserId),
  ]);
  const properties: TlonbotReplyFeedbackDetailsSubmitted &
    Record<string, unknown> = {
    ...common,
    feedbackId: next.feedbackId,
    revision: next.revision,
    clientEventAt,
    rating,
    categories,
    details,
    replyText: sanitizeAndTruncate(post.textContent, REPLY_TEXT_LIMIT),
    conversationExcerpt,
  };
  await captureMandatoryEvent({
    eventId: AnalyticsEvent.TlonbotReplyFeedbackDetailsSubmitted,
    properties,
  });
  return next;
}
