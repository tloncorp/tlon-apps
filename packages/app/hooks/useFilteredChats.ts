import { TalkSidebarFilter } from '@tloncorp/api/urbit';
import { useMessagesFilter } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

import { useCalm } from '../ui';
import { useChatSearch } from './useChatSearch';

export type TabName =
  | 'all'
  | 'home'
  | 'groups'
  | 'messages'
  | 'talk'
  | 'channels';

export type SectionedChatData = {
  title: string;
  data: db.Chat[];
}[];

function getAllSectionHeader(
  activeTab: TabName,
  msgsFilter?: TalkSidebarFilter
): string {
  if (activeTab === 'talk') {
    if (msgsFilter === 'Group Channels') {
      return 'Chat Channels';
    }

    return msgsFilter ?? 'Direct Messages';
  }

  return 'All';
}

export function useFilteredChats({
  pinned,
  unpinned,
  pending,
  searchQuery,
  activeTab,
}: {
  pinned: db.Chat[];
  unpinned: db.Chat[];
  pending: db.Chat[];
  searchQuery: string;
  activeTab: TabName;
}): SectionedChatData {
  const { disableNicknames } = useCalm();
  const { data } = useMessagesFilter();
  const talkFilter = useMemo(
    () =>
      activeTab === 'talk' ? data ?? 'Direct Messages' : 'Direct Messages',
    [data, activeTab]
  );
  const chats = useMemo(
    () => [...pinned, ...unpinned, ...pending],
    [pinned, unpinned, pending]
  );
  const searchableChats = useMemo(
    () => filterChats(chats, activeTab, talkFilter),
    [activeTab, chats, talkFilter]
  );
  const { results: searchResults } = useChatSearch({
    chats: searchableChats,
    searchQuery,
    debounceMs: 200,
    disableNicknames,
  });
  const pinnedChats = useMemo(
    () => filterChats(pinned, activeTab, talkFilter),
    [activeTab, pinned, talkFilter]
  );
  const allChats = useMemo(
    () => filterChats([...pending, ...unpinned], activeTab, talkFilter),
    [activeTab, pending, talkFilter, unpinned]
  );

  return useMemo(() => {
    const isSearching = searchQuery && searchQuery.trim() !== '';
    if (!isSearching) {
      const pinnedSection = {
        title: 'Pinned',
        data: pinnedChats,
      };
      const allSection = {
        title: getAllSectionHeader(activeTab, talkFilter),
        data: allChats,
      };
      return pinnedSection.data.length
        ? [pinnedSection, allSection]
        : [allSection];
    }

    return [
      {
        title: 'Search results',
        data: searchResults,
      },
    ];
  }, [activeTab, allChats, pinnedChats, searchQuery, searchResults, talkFilter]);
}

function filterChats(
  chats: db.Chat[],
  activeTab: TabName,
  filter: TalkSidebarFilter
) {
  return chats.filter((chat) => {
    if (activeTab === 'groups') {
      return chat.type === 'group';
    }

    if (
      activeTab === 'messages' ||
      activeTab === 'talk' ||
      activeTab === 'channels'
    ) {
      if (chat.type !== 'channel') {
        return false;
      }

      if (activeTab === 'channels') {
        return true;
      }

      if (filter === 'Direct Messages') {
        return chat.channel.type === 'dm' || chat.channel.type === 'groupDm';
      }

      if (filter === 'Group Channels') {
        return chat.channel.type === 'chat';
      }

      return (
        chat.channel.type === 'chat' ||
        chat.channel.type === 'dm' ||
        chat.channel.type === 'groupDm'
      );
    }

    if (activeTab === 'home') {
      return (
        chat.type === 'group' ||
        (chat.type === 'channel' && chat.channel.type === 'dm') ||
        (chat.type === 'channel' && chat.channel.type === 'groupDm')
      );
    }

    return true;
  });
}
