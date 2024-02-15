import { Unread } from '@/types/channel';
import { DMUnread } from '@/types/dms';
import bigInt from 'big-integer';

export function threadIsOlderThanLastRead(
  unread: DMUnread | Unread,
  threadId: string | null
): boolean {
  if (!unread || !threadId) {
    return false;
  }

  const mainChatUnread = unread.unread;
  const threadUnreads = unread.threads || {};
  const thread = threadUnreads[threadId];

  const hasMainChatUnread = mainChatUnread && mainChatUnread.count > 0;
  const hasThread = !!thread;

  if (hasThread && !hasMainChatUnread) {
    return true;
  }

  if (hasThread && hasMainChatUnread) {
    return 'parent-time' in thread && 'time' in mainChatUnread
      ? bigInt(thread['parent-time']).lesser(bigInt(mainChatUnread.time))
      : bigInt(threadId).lesser(bigInt(mainChatUnread.id));
  }

  return false;
}

export function getUnreadStatus(unread: DMUnread | Unread) {
  const mainChatUnread = unread.unread;
  const threadUnreads = unread.threads || {};

  const hasMainChatUnreads = mainChatUnread && mainChatUnread.count > 0;
  const hasThreadUnreads =
    Object.keys(threadUnreads).length > 0 &&
    Object.values(threadUnreads).some((thread) => thread.count > 0);

  return {
    hasMainChatUnreads,
    hasThreadUnreads,
    isEmpty: unread.count === 0,
  };
}
