import type * as db from '@tloncorp/shared/db';

export type SectionedChatData = {
  title: string;
  data: db.Chat[];
}[];

export const PINNED_SECTION_TITLE = 'Pinned';
export const DIRECT_MESSAGES_SECTION_TITLE = 'Private Messages';
export const GROUPS_SECTION_TITLE = 'You + Others';

function isDirectMessageChat(chat: db.Chat) {
  return (
    chat.type === 'channel' &&
    (chat.channel.type === 'dm' || chat.channel.type === 'groupDm')
  );
}

/**
 * Assemble the list's sections. When `separateDirectMessages` is set the
 * unpinned chats split into direct messages and everything else; anything that
 * is not a DM sorts with the groups, so no chat can fall out of the list.
 * Empty sections are dropped so a heading never stands alone.
 */
export function buildChatSections({
  pinnedChats,
  unpinnedChats,
  combinedSectionTitle,
  separateDirectMessages,
}: {
  pinnedChats: db.Chat[];
  unpinnedChats: db.Chat[];
  combinedSectionTitle: string;
  separateDirectMessages: boolean;
}): SectionedChatData {
  const unpinnedSections = separateDirectMessages
    ? [
        {
          title: DIRECT_MESSAGES_SECTION_TITLE,
          data: unpinnedChats.filter(isDirectMessageChat),
        },
        {
          title: GROUPS_SECTION_TITLE,
          data: unpinnedChats.filter((chat) => !isDirectMessageChat(chat)),
        },
      ].filter((section) => section.data.length)
    : [{ title: combinedSectionTitle, data: unpinnedChats }];

  return pinnedChats.length
    ? [{ title: PINNED_SECTION_TITLE, data: pinnedChats }, ...unpinnedSections]
    : unpinnedSections;
}
