import * as db from '@tloncorp/shared/db';

export type ChatListFilter = 'all' | 'just-me' | 'with-others' | 'messages';

export const CHAT_LIST_FILTER_LABELS: Record<ChatListFilter, string> = {
  all: 'All',
  'just-me': 'Just me',
  'with-others': 'With others',
  messages: 'Messages',
};

export const CHAT_LIST_FILTERS = Object.keys(
  CHAT_LIST_FILTER_LABELS
) as ChatListFilter[];

function isDirectMessage(chat: db.Chat) {
  return (
    chat.type === 'channel' &&
    (chat.channel.type === 'dm' || chat.channel.type === 'groupDm')
  );
}

/**
 * Whether a chat belongs in the workspace list.
 *
 * `getChats` returns every channel the account carries, group channels
 * included. A group channel is reached through its group, so only the groups
 * themselves, direct messages, and a chat channel the user pinned to the top
 * level stand on their own here.
 */
export function isWorkspaceChat(chat: db.Chat) {
  return (
    chat.type === 'group' ||
    isDirectMessage(chat) ||
    (chat.type === 'channel' && chat.channel.type === 'chat' && !!chat.pin)
  );
}

/**
 * Whether a group holds nobody but its owner and their bot.
 *
 * `getChats` loads only the first few members for avatar display, so an
 * unloaded member still counts: trust `memberCount` when it exceeds what was
 * loaded rather than reading the truncated list as the whole membership.
 */
function isSoloGroup(
  group: db.Group,
  currentUserId: string,
  botUserId: string
) {
  const members = group.members ?? [];
  const hasOther = members.some(
    (member) =>
      member.contactId !== currentUserId && member.contactId !== botUserId
  );
  if (hasOther) return false;
  return (group.memberCount ?? members.length) <= members.length;
}

/**
 * Split the chat list the way the filter tabs read it.
 *
 * The three narrow filters partition the list rather than each matching their
 * own idea of a chat: `with-others` is everything that is neither a DM nor a
 * solo group, so a pinned group channel — whose group's membership the list
 * query does not load — still appears somewhere instead of falling out.
 */
export function chatMatchesListFilter(
  chat: db.Chat,
  filter: ChatListFilter,
  { currentUserId, botUserId }: { currentUserId: string; botUserId: string }
): boolean {
  if (filter === 'all') return true;
  if (filter === 'messages') return isDirectMessage(chat);

  if (isDirectMessage(chat)) return false;
  const solo =
    chat.type === 'group' && isSoloGroup(chat.group, currentUserId, botUserId);
  return filter === 'just-me' ? solo : !solo;
}

export function filterChatsByListFilter(
  chats: db.Chat[],
  filter: ChatListFilter,
  ids: { currentUserId: string; botUserId: string }
): db.Chat[] {
  if (filter === 'all') return chats;
  return chats.filter((chat) => chatMatchesListFilter(chat, filter, ids));
}
