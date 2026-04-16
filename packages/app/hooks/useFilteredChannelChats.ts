import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useCalm } from '../ui/contexts/appDataContext';
import { useChatSearch } from './useChatSearch';
import { useResolvedChats } from './useResolvedChats';

type ChannelChat = db.Chat & { type: 'channel' };

function isChannelChat(chat: db.Chat): chat is ChannelChat {
  return chat.type === 'channel';
}

function buildChannelChatSearchKey(
  channelChats: ChannelChat[],
  disableNicknames: boolean
) {
  return `${disableNicknames ? 'nicknames-off' : 'nicknames-on'}:${channelChats
    .map((chat) =>
      [
        chat.id,
        chat.channel.title ?? '',
        chat.channel.members?.length ?? 0,
        chat.channel.group?.id ?? '',
        chat.channel.group?.title ?? '',
        chat.channel.group?.members?.length ?? 0,
        chat.channel.group?.privacy ?? '',
        chat.channel.group?.joinStatus ?? '',
        chat.channel.group?.haveInvite ? '1' : '0',
        chat.channel.group?.currentUserIsMember === false ? '0' : '1',
        chat.timestamp,
      ].join('\u0001')
    )
    .join('\u0002')}`;
}

export function useFilteredChannelChats({
  mode = 'live',
  searchQuery,
  channelFilter,
}: {
  mode?: 'live' | 'snapshot';
  searchQuery: string;
  channelFilter?: (channel: db.Channel) => boolean;
}) {
  const { disableNicknames } = useCalm();
  const { data: chats } = store.useCurrentChats();
  const resolvedChats = useResolvedChats(chats);

  const channelChats = useMemo(() => {
    const all = [...resolvedChats.pinned, ...resolvedChats.unpinned].filter(
      isChannelChat
    );

    return channelFilter
      ? all.filter((chat) => channelFilter(chat.channel))
      : all;
  }, [channelFilter, resolvedChats.pinned, resolvedChats.unpinned]);
  const liveChannelChatsRef = useRef(channelChats);
  liveChannelChatsRef.current = channelChats;
  const [frozenChannelChats, setFrozenChannelChats] =
    useState<ChannelChat[]>(channelChats);
  const shouldFreeze = mode === 'snapshot';

  useEffect(() => {
    if (shouldFreeze) {
      setFrozenChannelChats(liveChannelChatsRef.current);
    }
  }, [shouldFreeze]);

  useEffect(() => {
    if (!shouldFreeze) {
      return;
    }

    setFrozenChannelChats((current) =>
      current.length < channelChats.length
        ? liveChannelChatsRef.current
        : current
    );
  }, [shouldFreeze, channelChats.length]);
  const searchableChats = shouldFreeze ? frozenChannelChats : channelChats;
  const semanticCacheKey = useMemo(
    () => buildChannelChatSearchKey(searchableChats, disableNicknames),
    [searchableChats, disableNicknames]
  );

  const {
    isSearching,
    results: searchResults,
    allChats,
  } = useChatSearch({
    chats: searchableChats,
    searchQuery,
    debounceMs: 0,
    disableNicknames,
    semanticCacheKey,
  });

  return {
    channelChats: isSearching ? searchResults : allChats,
    isSearching,
  };
}
