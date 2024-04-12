import { Unread } from '@tloncorp/shared/dist/urbit/activity';
import bigInt from 'big-integer';

export function threadIsOlderThanLastRead(
  unread: Unread,
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
    return bigInt(thread['parent-time']).lesser(bigInt(mainChatUnread.time));
  }

  return false;
}

export function getUnreadStatus(unread: Unread) {
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
