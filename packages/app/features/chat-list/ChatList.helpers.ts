import * as db from '@tloncorp/shared/db';

import type { SectionedChatData } from '../../hooks/useFilteredChats';

export type SectionHeaderData = { type: 'sectionHeader'; title: string };
export type ChatListItemData = db.Chat | SectionHeaderData;

export function buildChatListItems(
  data: SectionedChatData
): ChatListItemData[] {
  return data.flatMap((section) => [
    { title: section.title, type: 'sectionHeader' },
    ...section.data,
  ]);
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
