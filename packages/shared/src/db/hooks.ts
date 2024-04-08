import { useEffect, useMemo } from 'react';

import { Channel, Group, Pin, Post, Unread } from '../db';
import * as queries from './queries';
import { createUseQuery } from './query';

export const useContact = createUseQuery(queries.getContact);

export const useContacts = createUseQuery(queries.getContacts);

export const useAllUnreadsCounts = createUseQuery(queries.getAllUnreadsCounts);

export const useUnreads = createUseQuery(queries.getUnreads);

export const useChats = createUseQuery(queries.getChats);

export const useGroups = createUseQuery(queries.getGroups);

export const useGroup = createUseQuery(queries.getGroup);
export const useGroupByChannel = createUseQuery(queries.getGroupByChannel);

export type Chat = Channel & {
  group?: Group | null;
  unread?: Unread | null;
  pin?: Pin | null;
  lastPost?: Post | null;
};

export interface CurrentChats {
  pinned: Chat[];
  unpinned: Chat[];
}

export const useCurrentChats = (): CurrentChats | null => {
  const { result: allChats, error } = useChats();
  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  return useMemo(() => {
    // If we don't have groups yet, return null
    if (!allChats) {
      return null;
    }
    // Groups are sorted by pinIndex, with those missing pinIndex at the end, so
    // we just find the first group without a pinIndex and split there.
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
};

export const useChannelPosts = createUseQuery(queries.getChannelPosts);
export const useChannelPostsAround = createUseQuery(
  queries.getChannelPostsAround
);
export const useChannelSearchResults = createUseQuery(
  queries.getChannelSearchResults
);
