import type * as db from '@tloncorp/shared/db';
import type * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

type UseCurrentChatsResult = ReturnType<typeof store.useCurrentChats>['data'];

/**
 * Memoizes the chat list structure based on relevant changes
 * (list lengths, unread counts) to prevent unnecessary recalculations
 * in downstream hooks like useFilteredChats.
 */
export function useResolvedChats(chats: UseCurrentChatsResult): {
  pinned: db.Chat[];
  unpinned: db.Chat[];
  pending: db.Chat[];
} {
  const [chatSignature, setChatSignature] = useState<string>('');

  // Track previous values and update the signature when meaningful changes occur
  useEffect(() => {
    if (!chats) return;

    const newSignature = JSON.stringify({
      pinnedLength: chats.pinned.length,
      unpinnedLength: chats.unpinned.length,
      pendingLength: chats.pending.length,
      pinnedUnreadCount: chats.pinned.reduce(
        (acc, chat) => acc + (chat.unreadCount ?? 0),
        0
      ),
      unpinnedUnreadCount: chats.unpinned.reduce(
        (acc, chat) => acc + (chat.unreadCount ?? 0),
        0
      ),
      pendingUnreadCount: chats.pending.reduce(
        (acc, chat) => acc + (chat.unreadCount ?? 0),
        0
      ),
      pinnedLastPostAt: chats.pinned.reduce(
        (latest, chat) =>
          Math.max(
            latest,
            chat.type === 'group'
              ? chat.group.lastPostAt ?? 0
              : chat.channel.lastPostAt ?? 0
          ),
        0
      ),
      unpinnedLastPostAt: chats.unpinned.reduce(
        (latest, chat) =>
          Math.max(
            latest,
            chat.type === 'group'
              ? chat.group.lastPostAt ?? 0
              : chat.channel.lastPostAt ?? 0
          ),
        0
      ),
      pendingLastPostAt: chats.pending.reduce(
        (latest, chat) =>
          Math.max(
            latest,
            chat.type === 'group'
              ? chat.group.lastPostAt ?? 0
              : chat.channel.lastPostAt ?? 0
          ),
        0
      ),
      pinnedTitles: chats.pinned
        .map((chat) =>
          chat.type === 'group' ? chat.group.title : chat.channel.title
        )
        .join('|'),
      unpinnedTitles: chats.unpinned
        .map((chat) =>
          chat.type === 'group' ? chat.group.title : chat.channel.title
        )
        .join('|'),
      pendingTitles: chats.pending
        .map((chat) =>
          chat.type === 'group' ? chat.group.title : chat.channel.title
        )
        .join('|'),
    });

    if (newSignature !== chatSignature) {
      setChatSignature(newSignature);
    }
  }, [chats, chatSignature]);

  // Only recalculate when the signature changes
  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pending: chats?.pending ?? [],
    };
  }, [chatSignature]);

  return resolvedChats;
}
