import { configurationFromChannel, useMessagesFilter } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { TalkSidebarFilter } from '@tloncorp/shared/urbit';
import Fuse from 'fuse.js';
import { debounce } from 'lodash';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useCalm } from '../ui';
import { getChannelTitle, getGroupTitle } from '../ui';

export type TabName = 'all' | 'home' | 'groups' | 'messages' | 'talk';

export type SectionedChatData = {
  title: string;
  data: db.Chat[];
}[];

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
  const performSearch = useChatSearch({ pinned, unpinned, pending });
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const searchResults = useMemo(
    () => performSearch(debouncedQuery),
    [debouncedQuery, performSearch]
  );

  const { data } = useMessagesFilter();
  const talkFilter = useMemo(
    () =>
      activeTab === 'talk' ? data ?? 'Direct Messages' : 'Direct Messages',
    [data, activeTab]
  );

  return useMemo(() => {
    const isSearching = searchQuery && searchQuery.trim() !== '';
    if (!isSearching) {
      const pinnedSection = {
        title: 'Pinned',
        data: filterChats(pinned, activeTab, talkFilter),
      };
      const allSection = {
        title: 'All',
        data: filterChats([...pending, ...unpinned], activeTab, talkFilter),
      };
      return pinnedSection.data.length
        ? [pinnedSection, allSection]
        : [allSection];
    } else {
      return [
        {
          title: 'Search results',
          data: filterChats(searchResults, activeTab, talkFilter),
        },
      ];
    }
  }, [
    activeTab,
    pending,
    searchQuery,
    searchResults,
    unpinned,
    pinned,
    talkFilter,
  ]);
}

function useChatSearch({
  pinned,
  unpinned,
  pending,
}: {
  pinned: db.Chat[];
  unpinned: db.Chat[];
  pending: db.Chat[];
}) {
  const { disableNicknames } = useCalm();

  const fuse = useMemo(() => {
    const allData = [...pinned, ...unpinned, ...pending];
    return new Fuse(allData, {
      keys: [
        {
          name: 'title',
          getFn: (chat: db.Chat) => {
            const title = getChatTitle(chat, disableNicknames);
            return Array.isArray(title)
              ? title.map(normalizeString)
              : normalizeString(title);
          },
        },
        {
          name: 'id',
          getFn: (chat: db.Chat) => {
            if (chat.type === 'channel') {
              return normalizeString(chat.channel.id);
            }
            return normalizeString(chat.group.id);
          },
        },
      ],
    });
  }, [pinned, unpinned, pending, disableNicknames]);

  function normalizeString(str: string) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  const performSearch = useCallback(
    (query: string) => {
      // necessary for web, otherwise fuse.search will throw
      // an error
      if (!query) return [];
      return fuse.search(query).map((result) => result.item);
    },
    [fuse]
  );

  return performSearch;
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

    if (activeTab === 'messages' || activeTab === 'talk') {
      if (chat.type !== 'channel') {
        return false;
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

function getChatTitle(chat: db.Chat, disableNicknames: boolean): string {
  if (chat.type === 'channel') {
    return getChannelTitle({
      disableNicknames,
      channelTitle: chat.channel.title,
      members: chat.channel.members,
      usesMemberListAsFallbackTitle: configurationFromChannel(chat.channel)
        .usesMemberListAsFallbackTitle,
    });
  } else {
    return getGroupTitle(chat.group, disableNicknames);
  }
}

function useDebouncedValue<T>(input: T, delay: number) {
  const [value, setValue] = useState<T>(input);
  const debouncedSetValue = useMemo(
    () => debounce(setValue, delay, { leading: true }),
    [delay]
  );
  useLayoutEffect(() => {
    debouncedSetValue(input);
  }, [debouncedSetValue, input]);
  return value;
}
