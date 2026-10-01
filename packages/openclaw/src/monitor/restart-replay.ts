/**
 * Restart replay: find messages that arrived while the gateway was down and
 * hand them to the same firehose handlers live messages go through, so
 * gating, allowlists, engagement rules and read marking all apply as usual.
 *
 * "Missed" is: changed on the ship in the last RESTART_REPLAY_WINDOW_MS
 * (`%channels`/`%chat` changes scries, keyed by the ship's receipt time) and
 * still unread. The plugin marks each channel/DM read once it has handled its
 * messages (see activity-read.ts), so unread means the plugin never got to it.
 * Outages longer than the window are not caught up.
 */
export const RESTART_REPLAY_WINDOW_MS = 15 * 60 * 1000;

/** First unread post per source, from the %activity unread summary. */
export interface UnreadAnchors {
  /** channel nest, DM ship, or club id → first unread post id */
  sources: Map<string, string>;
  /** `${channel}|${parentId}` → first unread reply id */
  threads: Map<string, string>;
}

// Raw scry JSON, typed only as far as replay reads it. The essays pass through
// untouched, so the handlers see exactly what the live firehose would carry.
type RawEssay = { sent?: number; [field: string]: unknown };
type RawReply = {
  seal?: { id?: string; [field: string]: unknown };
  'reply-essay'?: RawEssay;
};
type RawPost = {
  type?: string;
  seal?: {
    id?: string;
    time?: string;
    replies?: Record<string, RawReply | null> | null;
    [field: string]: unknown;
  };
  essay?: RawEssay;
};

/** Same shapes as the `%channels`/`%chat` /v4 firehose facts. */
export type ChannelReplayEvent = {
  nest: string;
  response: {
    post: {
      id: string;
      'r-post':
        | { set: RawPost }
        | { reply: { id: string; 'r-reply': { set: RawReply } } };
    };
  };
};
export type ChatReplayEvent = {
  whom: string;
  id: string;
  response:
    | { add: { essay: RawEssay | undefined; time: string } }
    | {
        reply: {
          id: string;
          delta: { add: { 'reply-essay': RawEssay | undefined } };
        };
      };
};

export type ReplayItem =
  | { kind: 'channel'; sent: number; event: ChannelReplayEvent }
  | { kind: 'chat'; sent: number; event: ChatReplayEvent };
type RawPosts = Record<string, RawPost | null> | null;

/** The trailing @ud of a post/writ/reply id, as a comparable number. */
function idValue(id: string): bigint | null {
  const tail = id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
  const digits = tail.replace(/\./g, '');
  return /^[0-9]+$/.test(digits) ? BigInt(digits) : null;
}

function isAtOrAfter(id: string, anchor: string | undefined): boolean {
  if (!anchor) return false;
  const value = idValue(id);
  const first = idValue(anchor);
  return value !== null && first !== null && value >= first;
}

const threadKey = (channel: string, parentId: string) =>
  `${channel}|${idValue(parentId)?.toString() ?? parentId}`;

/** Build unread anchors from `toClientUnreads` output. */
export function unreadAnchors(unreads: {
  channelUnreads: {
    channelId?: string | null;
    firstUnreadPostId?: string | null;
  }[];
  threadActivity: {
    channelId?: string | null;
    threadId?: string | null;
    firstUnreadPostId?: string | null;
  }[];
}): UnreadAnchors {
  const sources = new Map<string, string>();
  for (const unread of unreads.channelUnreads) {
    if (unread.channelId && unread.firstUnreadPostId) {
      sources.set(unread.channelId, unread.firstUnreadPostId);
    }
  }
  const threads = new Map<string, string>();
  for (const unread of unreads.threadActivity) {
    if (unread.channelId && unread.threadId && unread.firstUnreadPostId) {
      threads.set(
        threadKey(unread.channelId, unread.threadId),
        unread.firstUnreadPostId
      );
    }
  }
  return { sources, threads };
}

function collect(
  posts: RawPosts,
  conversation: string,
  anchors: UnreadAnchors,
  toItem: (
    post: { id: string; raw: RawPost; sent: number },
    reply?: { id: string; raw: RawReply; sent: number }
  ) => ReplayItem
): ReplayItem[] {
  const items: ReplayItem[] = [];
  for (const [key, post] of Object.entries(posts ?? {})) {
    if (!post || post.type === 'tombstone') continue;
    const id = post.seal?.id ?? key;
    const sent = post.essay?.sent ?? 0;
    if (isAtOrAfter(id, anchors.sources.get(conversation))) {
      items.push(toItem({ id, raw: post, sent }));
    }
    const threadAnchor = anchors.threads.get(threadKey(conversation, id));
    for (const [replyKey, reply] of Object.entries(post.seal?.replies ?? {})) {
      if (!reply) continue;
      const replyId = reply.seal?.id ?? replyKey;
      if (!isAtOrAfter(replyId, threadAnchor)) continue;
      items.push(
        toItem(
          { id, raw: post, sent },
          { id: replyId, raw: reply, sent: reply['reply-essay']?.sent ?? 0 }
        )
      );
    }
  }
  return items;
}

/**
 * Turn `%channels` and `%chat` changes into firehose events for every post or
 * reply that is still unread, oldest first.
 */
export function collectMissedMessages(input: {
  channels: Record<string, RawPosts>;
  chat: Record<string, RawPosts>;
  anchors: UnreadAnchors;
}): ReplayItem[] {
  const items: ReplayItem[] = [];
  for (const [nest, posts] of Object.entries(input.channels ?? {})) {
    items.push(
      ...collect(posts, nest, input.anchors, (post, reply) => ({
        kind: 'channel',
        sent: reply?.sent ?? post.sent,
        event: {
          nest,
          response: {
            post: {
              id: post.id,
              'r-post': reply
                ? { reply: { id: reply.id, 'r-reply': { set: reply.raw } } }
                : { set: post.raw },
            },
          },
        },
      }))
    );
  }
  for (const [whom, writs] of Object.entries(input.chat ?? {})) {
    items.push(
      ...collect(writs, whom, input.anchors, (writ, reply) => ({
        kind: 'chat',
        sent: reply?.sent ?? writ.sent,
        event: {
          whom,
          id: writ.id,
          response: reply
            ? {
                reply: {
                  id: reply.id,
                  delta: { add: { 'reply-essay': reply.raw['reply-essay'] } },
                },
              }
            : {
                add: {
                  essay: writ.raw.essay,
                  time: writ.raw.seal?.time ?? '',
                },
              },
        },
      }))
    );
  }
  return items.sort((a, b) => a.sent - b.sent);
}
