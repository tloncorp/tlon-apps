/**
 * Parse %channels and %chat firehose events (/v4 subscriptions) into a
 * simple inbound-message shape. Event structures mirror the local types in
 * the OpenClaw Tlon plugin's monitor (packages/openclaw/src/monitor/index.ts).
 *
 * Only new posts and replies are surfaced; reactions, edits, and deletes are
 * ignored — the attached session cares about conversation turns.
 */
import { extractStoryText } from './story-text.js';

export type InboundMessage = {
  kind: 'dm' | 'club' | 'channel';
  /** DM counterparty or club id (chat firehose only) */
  whom?: string;
  /** Channel nest (channels firehose only) */
  nest?: string;
  /** Message id (post id, or writ id for DMs) */
  id: string;
  /** Top-level post id when this is a thread reply */
  parentId?: string;
  author: string;
  text: string;
  sent: number;
};

type Author = string | { ship?: string };

function authorShip(author: Author | undefined): string | undefined {
  if (typeof author === 'string') {
    return author;
  }
  return author?.ship;
}

type Essay = { content?: unknown; author?: Author; sent?: number };

/** channels /v4 — { nest, response: { post: ... } } */
export function parseChannelsEvent(event: unknown): InboundMessage | null {
  if (!event || typeof event !== 'object') {
    return null;
  }
  const evt = event as {
    nest?: string;
    response?: {
      post?: {
        id?: string;
        'r-post'?: {
          set?: { essay?: Essay } | null;
          reply?: {
            id?: string;
            'r-reply'?: { set?: { 'reply-essay'?: Essay } | null };
          };
        };
      };
    };
  };
  const nest = evt.nest;
  const post = evt.response?.post;
  if (!nest || !post) {
    return null;
  }

  const rPost = post['r-post'];
  const topEssay = rPost?.set?.essay;
  if (topEssay) {
    const author = authorShip(topEssay.author);
    if (!author || !post.id) {
      return null;
    }
    return {
      kind: 'channel',
      nest,
      id: post.id,
      author,
      text: extractStoryText(topEssay.content),
      sent: topEssay.sent ?? Date.now(),
    };
  }

  const reply = rPost?.reply;
  const replyEssay = reply?.['r-reply']?.set?.['reply-essay'];
  if (replyEssay && post.id) {
    const author = authorShip(replyEssay.author);
    if (!author) {
      return null;
    }
    return {
      kind: 'channel',
      nest,
      id: reply?.id ?? '',
      parentId: post.id,
      author,
      text: extractStoryText(replyEssay.content),
      sent: replyEssay.sent ?? Date.now(),
    };
  }

  return null;
}

/** chat /v4 — { whom, id, response: delta } (DM invites arrive as arrays; ignored) */
export function parseChatEvent(event: unknown): InboundMessage | null {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return null;
  }
  const evt = event as {
    whom?: string;
    id?: string;
    response?: {
      add?: { essay?: Essay };
      reply?: {
        id?: string;
        delta?: { add?: { 'reply-essay'?: Essay; id?: string } };
      };
    };
  };
  const whom = evt.whom;
  if (!whom) {
    return null;
  }
  const kind: InboundMessage['kind'] = whom.startsWith('0v') ? 'club' : 'dm';

  const essay = evt.response?.add?.essay;
  if (essay) {
    const author = authorShip(essay.author);
    if (!author) {
      return null;
    }
    return {
      kind,
      whom,
      id: evt.id ?? '',
      author,
      text: extractStoryText(essay.content),
      sent: essay.sent ?? Date.now(),
    };
  }

  const replyEssay = evt.response?.reply?.delta?.add?.['reply-essay'];
  if (replyEssay) {
    const author = authorShip(replyEssay.author);
    if (!author) {
      return null;
    }
    return {
      kind,
      whom,
      id: evt.response?.reply?.delta?.add?.id ?? '',
      parentId: evt.id,
      author,
      text: extractStoryText(replyEssay.content),
      sent: replyEssay.sent ?? Date.now(),
    };
  }

  return null;
}
