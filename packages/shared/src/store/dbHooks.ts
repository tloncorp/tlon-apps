import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as db from '../db';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export * from './useChannelSearch';

// Assorted small hooks for fetching data from the database.
// Can break em out as they get bigger.

export interface CurrentChats {
  pinned: db.Channel[];
  unpinned: db.Channel[];
}

export const useCalmSettings = (options: { userId: string }) => {
  return useQuery({
    queryKey: ['calmSettings'],
    queryFn: () =>
      db.getSettings(options.userId).then((r) => ({
        disableAvatars: r?.disableAvatars ?? false,
        disableNicknames: r?.disableNicknames ?? false,
        disableRemoteContent: r?.disableRemoteContent ?? false,
      })),
  });
};

export const useSettings = (options: { userId: string }) => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => db.getSettings(options.userId),
  });
};

export const useCurrentChats = (): UseQueryResult<CurrentChats | null> => {
  return useQuery({
    queryFn: db.getChats,
    queryKey: ['currentChats', useKeyFromQueryDeps(db.getGroup)],
    select(channels: db.Channel[]) {
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

export const useGroup = (options: { id?: string }) => {
  return useQuery({
    enabled: !!options.id,
    queryKey: [['group', options], useKeyFromQueryDeps(db.getGroup, options)],
    queryFn: () => {
      if (!options.id) {
        // This should never actually get thrown as the query is disabled if id
        // is missing
        throw new Error('missing id');
      }
      const enabledOptions = options as { id: string };
      return db.getGroup(enabledOptions);
    },
  });
};

export const useGroupByChannel = (channelId: string) => {
  return useQuery({
    queryKey: [['group', channelId]],
    queryFn: () => db.getGroupByChannel(channelId).then((r) => r ?? null),
  });
};

export const useMemberRoles = (chatId: string, userId: string) => {
  const { data: chatMember } = useQuery({
    queryKey: ['memberRoles', chatId, userId],
    queryFn: () => db.getChatMember({ chatId, contactId: userId }),
  });

  const memberRoles = useMemo(
    () => chatMember?.roles.map((role) => role.roleId) ?? [],
    [chatMember]
  );

  return memberRoles;
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

export const usePostWithRelations = (options: { id: string }) => {
  return useQuery({
    queryKey: [['post', options]],
    queryFn: () => db.getPostWithRelations(options),
  });
};
