import { configurationFromChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCalm } from '../ui';
import { getChannelTitle, getGroupTitle } from '../ui';
import Fuse from 'fuse.js';
import { debounce } from 'lodash';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

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

  return useMemo(() => {
    const isSearching = searchQuery && searchQuery.trim() !== '';
    if (!isSearching) {
      const pinnedSection = {
        title: 'Pinned',
        data: filterChats(pinned, activeTab),
      };
      const allSection = {
        title: 'All',
        data: filterChats([...pending, ...unpinned], activeTab),
      };
      return pinnedSection.data.length
        ? [pinnedSection, allSection]
        : [allSection];
    } else {
      return [
        {
          title: 'Search results',
          data: filterChats(searchResults, activeTab),
        },
      ];
    }
  }, [activeTab, pending, searchQuery, searchResults, unpinned, pinned]);
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

function filterChats(chats: db.Chat[], activeTab: TabName) {
  return chats.filter((chat) => {
    if (activeTab === 'groups') {
      return chat.type === 'group';
    }

    if (activeTab === 'messages' || activeTab === 'talk') {
      if (chat.type !== 'channel') {
        return false;
      }

      return (
        (activeTab === 'talk' && chat.channel.type === 'chat') ||
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
