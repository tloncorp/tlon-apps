import type * as db from '../types/models';

export function isChatChannel(channel: db.Channel): boolean {
  return (
    channel.type === 'chat' ||
    channel.type === 'dm' ||
    channel.type === 'groupDm'
  );
}

/**
 * Ordered posts are the canonical backend source for pinned posts.
 */
export function getPinnedPostId(channel: db.Channel): string | null {
  return channel.order?.[0] ?? null;
}

export function isChannel(obj: db.Channel | db.Group): obj is db.Channel {
  return !('hostUserId' in obj);
}

export function isGroup(obj: db.Channel | db.Group): obj is db.Group {
  return 'hostUserId' in obj;
}
