import { UseQueryResult, useQuery } from '@tanstack/react-query';

import * as db from '../db';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export * from './useChannelSearch';

// Assorted small hooks for fetching data from the database.
// Can break em out as they get bigger.

export interface CurrentChats {
  pinned: db.ChannelSummary[];
  unpinned: db.ChannelSummary[];
}

export const useCurrentChats = (): UseQueryResult<CurrentChats | null> => {
  return useQuery({
    queryFn: db.getChats,
    queryKey: ['currentChats', useKeyFromQueryDeps(db.getGroup)],
    select(channels: db.ChannelSummary[]) {
      for (let i = 0; i < channels.length; ++i) {
        if (!channels[i].pin) {
          return {
            pinned: channels.slice(0, i),
            unpinned: channels.slice(i),
          };
        }
      }
      return {
        pinned: channels,
        unpinned: [],
      };
    },
  });
};

export const useContact = (options: { id: string }) => {
  return useQuery({
    queryKey: [['contact', options]],
    queryFn: () => db.getContact(options),
  });
};

export const useContacts = () => {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: db.getContacts,
  });
};

export const useAllUnreadsCounts = () => {
  return useQuery({
    queryKey: ['allUnreadsCounts'],
    queryFn: db.getAllUnreadsCounts,
  });
};

export const useUnreads = (options: db.GetUnreadsOptions) => {
  return useQuery({
    queryKey: ['unreads'],
    queryFn: () => db.getUnreads(options),
  });
};

export const useGroups = (options: db.GetGroupsOptions) => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => db.getGroups(options).then((r) => r ?? null),
  });
};

export const useGroup = (options: { id: string }) => {
  return useQuery({
    queryKey: [['group', options], useKeyFromQueryDeps(db.getGroup, options)],
    queryFn: () =>
      db.getGroup(options).then((r) => {
        return r ?? null;
      }),
  });
};

export const useGroupByChannel = (channelId: string) => {
  return useQuery({
    queryKey: [['group', channelId]],
    queryFn: () => db.getGroupByChannel(channelId).then((r) => r ?? null),
  });
};

export const useChannelPostsAround = (
  options: db.GetChannelPostsAroundOptions
) => {
  return useQuery({
    queryKey: [['channelPostsAround', options]],
    queryFn: () => db.getChannelPostsAround(options),
  });
};

export const useChannelSearchResults = (
  channelId: string,
  postIds: string[]
) => {
  return useQuery({
    queryKey: [['channelSearchResults', channelId, postIds]],
    queryFn: () => db.getChannelSearchResults(channelId, postIds),
  });
};

export const useChannelWithLastPostAndMembers = (
  options: db.GetChannelWithLastPostAndMembersOptions
) => {
  return useQuery({
    queryKey: [['channelWithLastPostAndMembers', options]],
    queryFn: () => db.getChannelWithLastPostAndMembers(options),
  });
};

export const useChannel = (options: { id: string }) => {
  return useQuery({
    queryKey: [['channel', options]],
    queryFn: () => db.getChannel(options),
  });
};
