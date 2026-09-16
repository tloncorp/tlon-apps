import * as db from '@tloncorp/shared/db';

import type { SectionedChatData } from '../../hooks/useFilteredChats';

export type SectionHeaderData = { type: 'sectionHeader'; title: string };
export type ChatListItemData = db.Chat | SectionHeaderData;

export const PINNED_SECTION_TITLE = 'Pinned';

export function buildChatListItems(
  data: SectionedChatData
): ChatListItemData[] {
  return data.flatMap((section) => [
    { title: section.title, type: 'sectionHeader' },
    ...section.data,
  ]);
}

/**
 * Split the sectioned chat data into the pinned chats (rendered as a sortable
 * `ListHeaderComponent` block, TLON-5948) and the remaining sections (which
 * feed the virtualized `FlashList`). When searching there is no pinned section,
 * so `pinned` is empty and `rest` is the single search-results section.
 */
export function splitPinnedSection(data: SectionedChatData): {
  pinned: db.Chat[];
  rest: SectionedChatData;
} {
  const pinned: db.Chat[] = [];
  const rest: SectionedChatData = [];
  for (const section of data) {
    if (section.title === PINNED_SECTION_TITLE) {
      pinned.push(...section.data);
    } else {
      rest.push(section);
    }
  }
  return { pinned, rest };
}

export function isSectionHeader(
  data: ChatListItemData
): data is SectionHeaderData {
  return 'type' in data && data.type === 'sectionHeader';
}

export function getItemType(item: ChatListItemData): string {
  return isSectionHeader(item) ? 'sectionHeader' : item.type;
}

export function getChatKey(chatItem: ChatListItemData): string {
  if (!chatItem || typeof chatItem !== 'object') {
    return 'invalid-item';
  }

  if (isSectionHeader(chatItem)) {
    return chatItem.title;
  }

  return `${chatItem.id}-${chatItem.pin?.itemId ?? ''}`;
}

export function buildChatListFlashListProps({
  data,
  disableScrollAnchoring,
}: {
  data: SectionedChatData;
  disableScrollAnchoring?: boolean;
}): {
  data: ChatListItemData[];
  maintainVisibleContentPosition?: { disabled: true };
} {
  const items = buildChatListItems(data);
  if (disableScrollAnchoring) {
    return {
      data: items,
      maintainVisibleContentPosition: { disabled: true },
    };
  }
  return { data: items };
}
