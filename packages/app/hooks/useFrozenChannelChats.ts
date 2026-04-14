import * as db from '@tloncorp/shared/db';
import { useEffect, useRef, useState } from 'react';

import { useFilteredChannelChats } from './useFilteredChannelChats';

type ChannelChat = db.Chat & { type: 'channel' };

export function useFrozenChannelChats({
  isOpen,
  channelFilter,
}: {
  isOpen: boolean;
  channelFilter?: (channel: db.Channel) => boolean;
}) {
  const { channelChats: liveChannelChats } = useFilteredChannelChats({
    searchQuery: '',
    channelFilter,
  });
  const liveChannelChatsRef = useRef(liveChannelChats);
  liveChannelChatsRef.current = liveChannelChats;
  const [frozenChannelChats, setFrozenChannelChats] =
    useState<ChannelChat[]>(liveChannelChats);

  useEffect(() => {
    if (isOpen) {
      setFrozenChannelChats(liveChannelChatsRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFrozenChannelChats((current) =>
      current.length < liveChannelChats.length
        ? liveChannelChatsRef.current
        : current
    );
  }, [isOpen, liveChannelChats.length]);

  return frozenChannelChats;
}
