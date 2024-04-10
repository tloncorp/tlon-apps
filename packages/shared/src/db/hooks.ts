import { useEffect, useMemo } from 'react';

import { ChannelSummary } from '../db';
import * as queries from './queries';
import type { UseQueryResult } from './query';
import { createUseQuery } from './query';

export const useContact = createUseQuery(queries.getContact);

export const useContacts = createUseQuery(queries.getContacts);

export const useAllUnreadsCounts = createUseQuery(queries.getAllUnreadsCounts);

export const useUnreads = createUseQuery(queries.getUnreads);

export const useChats = createUseQuery(queries.getChats);

export const useGroups = createUseQuery(queries.getGroups);

export const useGroup = createUseQuery(queries.getGroup);
export const useGroupByChannel = createUseQuery(queries.getGroupByChannel);

export interface CurrentChats {
  pinned: ChannelSummary[];
  unpinned: ChannelSummary[];
}

export const useCurrentChats = (): UseQueryResult<CurrentChats | null> => {
  const { result: allChats, error, isLoading } = useChats();
  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  const result = useMemo(() => {
    // If we don't have groups yet, return null
    if (!allChats) {
      return null;
    }
    // Chats are sorted by pin index, with those not pinned at the end, so
    // we just find the first group without a pin and split there.
    for (let i = 0; i < allChats?.length; ++i) {
      if (allChats[i] && typeof allChats[i].pin?.index !== 'number') {
        return {
          pinned: allChats.slice(0, i),
          unpinned: allChats.slice(i),
        };
      }
    }
    // all groups are pinned
    return {
      pinned: allChats,
      unpinned: [],
    };
  }, [allChats]);

  return useMemo(
    () => ({ result, isLoading, error }),
    [result, isLoading, error]
  );
};

export const useChannelPosts = createUseQuery(queries.getChannelPosts);
export const useChannelPostsAround = createUseQuery(
  queries.getChannelPostsAround
);
export const useChannelSearchResults = createUseQuery(
  queries.getChannelSearchResults
);
export const useChannelWithLastPostAndMembers = createUseQuery(
  queries.getChannelWithLastPostAndMembers
);
