/**
 * Restart replay: find messages that arrived while the gateway was down and
 * hand them to the same firehose handlers live messages go through, so
 * gating, allowlists, engagement rules and read marking all apply as usual.
 *
 * "Missed" is: changed on the ship in the last RESTART_REPLAY_WINDOW_MS (the
 * `/changes` package, keyed by the ship's receipt time) and still unread. The
 * plugin marks each channel/DM read once it has handled its messages (see
 * activity-read.ts), so unread means the plugin never got to it. Outages
 * longer than the window are not caught up.
 */
import {
  type ActivityInit,
  type ChangesV11,
  type PostDataResponse,
  type PostResponse,
  type Reply,
  type WritReply,
  type WritResponse,
  getCanonicalPostId,
} from '@tloncorp/api';

import { channelReadKey, dmReadKey } from './activity-read.js';

export const RESTART_REPLAY_WINDOW_MS = 15 * 60 * 1000;

/** Same shape as a `%channels` /v4 firehose post fact. */
export type ChannelReplayEvent = {
  nest: string;
  response: { post: { id: string; 'r-post': PostResponse } };
};

/** `key` is the source's activity-read tracker key. */
export type ReplayItem =
  | { kind: 'channel'; key: string; sent: number; event: ChannelReplayEvent }
  | { kind: 'chat'; key: string; sent: number; event: WritResponse };

// The wire carries a post's replies as a map, i.e. PostDataResponse; ub.Post
// types them as tuples. DM writs add the ship's receipt time to the seal.
type RawPost = PostDataResponse & {
  type?: string;
  seal: PostDataResponse['seal'] & { time?: string };
};
type ChannelPost = Extract<PostResponse, { set: unknown }>['set'];

function idValue(id: string): bigint | null {
  const digits = getCanonicalPostId(id).replace(/\./g, '');
  return /^[0-9]+$/.test(digits) ? BigInt(digits) : null;
}

/** At or after the first unread post of its source (or thread). */
function isUnread(id: string, firstUnread: string | null | undefined) {
  if (!firstUnread) return false;
  const value = idValue(id);
  const first = idValue(firstUnread);
  return value !== null && first !== null && value >= first;
}

function collect(
  posts: Record<string, unknown> | null,
  conversation: string,
  unreads: ActivityInit,
  toItem: (post: RawPost, reply?: Reply | WritReply) => ReplayItem
): ReplayItem[] {
  const sourceAnchor = unreads.channelUnreads.find(
    (unread) => unread.channelId === conversation
  )?.firstUnreadPostId;
  const items: ReplayItem[] = [];
  for (const value of Object.values(posts ?? {})) {
    const post = value as RawPost | null;
    if (!post?.seal || post.type === 'tombstone') continue;
    if (isUnread(post.seal.id, sourceAnchor)) items.push(toItem(post));
    const threadId = getCanonicalPostId(post.seal.id);
    const threadAnchor = unreads.threadActivity.find(
      (unread) =>
        unread.channelId === conversation && unread.threadId === threadId
    )?.firstUnreadPostId;
    if (!threadAnchor) continue;
    for (const reply of Object.values(post.seal.replies ?? {})) {
      if (!('seal' in reply) || !('reply-essay' in reply)) continue;
      if (isUnread(reply.seal.id, threadAnchor)) {
        items.push(toItem(post, reply));
      }
    }
  }
  return items;
}

/**
 * Turn a `/changes` package into firehose events for every post or reply that
 * is still unread, oldest first.
 */
export function collectMissedMessages(
  changes: Pick<ChangesV11, 'channels' | 'chat'>,
  unreads: ActivityInit
): ReplayItem[] {
  const items: ReplayItem[] = [];
  for (const [nest, posts] of Object.entries(changes.channels ?? {})) {
    items.push(
      ...collect(posts, nest, unreads, (post, reply) => ({
        kind: 'channel',
        key: channelReadKey(nest),
        sent: (reply?.['reply-essay'] ?? post.essay).sent,
        event: {
          nest,
          response: {
            post: {
              id: post.seal.id,
              'r-post': reply
                ? {
                    reply: {
                      id: reply.seal.id,
                      meta: post.seal.meta,
                      'r-reply': { set: reply as Reply },
                    },
                  }
                : { set: post as unknown as ChannelPost },
            },
          },
        },
      }))
    );
  }
  for (const [whom, writs] of Object.entries(changes.chat ?? {})) {
    items.push(
      ...collect(writs, whom, unreads, (writ, reply) => ({
        kind: 'chat',
        key: dmReadKey(whom),
        sent: (reply?.['reply-essay'] ?? writ.essay).sent,
        event: {
          whom,
          id: writ.seal.id,
          response: reply
            ? {
                reply: {
                  id: reply.seal.id,
                  meta: writ.seal.meta,
                  delta: {
                    add: {
                      'reply-essay': reply['reply-essay'],
                      time: null,
                    },
                  },
                },
              }
            : {
                add: { essay: writ.essay, time: writ.seal.time ?? '' },
              },
        },
      }))
    );
  }
  return items.sort((a, b) => a.sent - b.sent);
}
