import {
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '../api';
import * as db from '../db';
import {
  getIsHosted,
  hasCustomS3Creds,
  hasHostingUploadCreds,
} from './storage';
import { syncPostReference } from './sync';
import { keyFromQueryDeps, useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export * from './useChannelSearch';

// Assorted small hooks for fetching data from the database.
// Can break em out as they get bigger.

export interface CurrentChats {
  pinned: db.Channel[];
  unpinned: db.Channel[];
  pendingChats: (db.Group | db.Channel)[];
}

export type CustomQueryConfig<T> = Pick<
  UseQueryOptions<T, Error, T>,
  'enabled'
>;

export const useCurrentChats = (
  queryConfig?: CustomQueryConfig<CurrentChats>
): UseQueryResult<CurrentChats | null> => {
  return useQuery({
    queryFn: async () => {
      const [pendingChats, channels] = await Promise.all([
        db.getPendingChats(),
        db.getChats(),
      ]);
      return { channels, pendingChats };
    },
    queryKey: ['currentChats', useKeyFromQueryDeps(db.getChats)],
    select({ channels, pendingChats }) {
      for (let i = 0; i < channels.length; ++i) {
        if (!channels[i].pin) {
          return {
            pinned: channels.slice(0, i),
            unpinned: channels.slice(i),
            pendingChats,
          };
        }
      }
      return {
        pinned: channels,
        unpinned: [],
        pendingChats,
      };
    },
    ...queryConfig,
  });
};

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

export const useAppInfo = () => {
  return useQuery({
    queryKey: db.APP_INFO_QUERY_KEY,
    queryFn: db.getAppInfoSettings,
  });
};

export const useActivitySeenMarker = () => {
  return useQuery({
    queryKey: db.ACTIVITY_SEEN_MARKER_QUERY_KEY,
    queryFn: () => db.getActivitySeenMarker(),
  });
};

export const usePushNotificationsSetting = () => {
  return useQuery({
    queryKey: db.PUSH_NOTIFICATIONS_SETTING_QUERY_KEY,
    queryFn: db.getPushNotificationsSetting,
  });
};

export const useIsTlonEmployee = () => {
  return useQuery({
    queryKey: db.IS_TLON_EMPLOYEE_QUERY_KEY,
    queryFn: db.getIsTlonEmployee,
  });
};

export const useCanUpload = () => {
  return (
    useQuery({
      queryKey: db.STORAGE_SETTINGS_QUERY_KEY,
      queryFn: async () => {
        const [config, credentials] = await Promise.all([
          db.getStorageConfiguration(),
          db.getStorageCredentials(),
        ]);
        return (
          !config ||
          hasHostingUploadCreds(config, credentials) ||
          hasCustomS3Creds(config, credentials)
        );
      },
    }).data ?? true
  );
};

export const useContact = (options: { id: string }) => {
  const deps = useKeyFromQueryDeps(db.getContact);
  return useQuery({
    queryKey: [['contact', deps]],
    queryFn: () => db.getContact(options),
  });
};

export const useBlockedContacts = () => {
  const depsKey = useKeyFromQueryDeps(db.getBlockedUsers);
  return useQuery({
    queryKey: ['blockedContacts', depsKey],
    queryFn: () => db.getBlockedUsers(),
  });
};

export const useContacts = () => {
  const deps = useKeyFromQueryDeps(db.getContacts);
  return useQuery({
    queryKey: ['contacts', deps],
    queryFn: () => db.getContacts(),
  });
};

export const useUnreadsCount = () => {
  return useQuery({
    queryKey: ['unreadsCount'],
    queryFn: () => db.getUnreadsCount({}),
  });
};

export const useHaveUnreadUnseenActivity = () => {
  const depsKey = useKeyFromQueryDeps(db.getUnreadUnseenActivityEvents);
  const { data: seenMarker } = useActivitySeenMarker();
  const { data: meaningfulUnseenActivity } = useQuery({
    queryKey: ['unseenUnreadActivity', depsKey, seenMarker],
    queryFn: () =>
      db.getUnreadUnseenActivityEvents({ seenMarker: seenMarker ?? Infinity }),
  });

  return (meaningfulUnseenActivity?.length ?? 0) > 0;
};

export const useLiveThreadUnread = (unread: db.ThreadUnreadState | null) => {
  const depsKey = useMemo(
    () => (unread ? keyFromQueryDeps(db.getThreadUnreadState) : null),
    [unread]
  );

  return useQuery({
    queryKey: [
      'liveUnreadCount',
      depsKey,
      'thread',
      unread ? unread.threadId : null,
    ],
    queryFn: async () => {
      if (unread) {
        return db.getThreadUnreadState({ parentId: unread.threadId ?? '' });
      }
      return null;
    },
  });
};

export const useLiveChannelUnread = (unread: db.ChannelUnread | null) => {
  const depsKey = useMemo(
    () => (unread ? keyFromQueryDeps(db.getChannelUnread) : null),
    [unread]
  );

  return useQuery({
    queryKey: [
      'liveUnreadCount',
      depsKey,
      'channel',
      unread ? unread.channelId : null,
    ],
    queryFn: async () => {
      if (unread) {
        return db.getChannelUnread({ channelId: unread.channelId ?? '' });
      }
      return null;
    },
  });
};

export const useLiveUnread = (
  unread: db.ChannelUnread | db.ThreadUnreadState | null
) => {
  const isThread = useMemo(() => unread && 'threadId' in unread, [unread]);
  const threadUnread = useLiveThreadUnread(
    isThread ? (unread as db.ThreadUnreadState) : null
  );
  const channelUnread = useLiveChannelUnread(
    isThread ? null : (unread as db.ChannelUnread | null)
  );
  return isThread ? threadUnread : channelUnread;
};

export const useGroups = (options: db.GetGroupsOptions) => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => db.getGroups(options).then((r) => r ?? null),
  });
};

export const useGroupPreviews = (groupIds: string[]) => {
  const depsKey = useKeyFromQueryDeps(db.getGroupPreviews);
  return useQuery({
    queryKey: ['groupPreviews', depsKey, groupIds],
    queryFn: () => db.getGroupPreviews(groupIds),
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

export const useGroupPreview = (groupId: string) => {
  const tableDeps = useKeyFromQueryDeps(db.getGroup);
  return useQuery({
    queryKey: ['groupPreview', tableDeps, groupId],
    queryFn: async () => {
      const group = await db.getGroup({ id: groupId });
      if (group) {
        return group;
      }

      const groupPreview = await api.getGroupPreview(groupId);
      await db.insertUnjoinedGroups([groupPreview]);
      return groupPreview;
    },
  });
};

export const usePostReference = ({
  channelId,
  postId,
  replyId,
}: {
  channelId: string;
  postId: string;
  replyId?: string;
}) => {
  const postQuery = useQuery({
    queryKey: ['postReference', postId],
    queryFn: async () => {
      const post = await db.getPostWithRelations({ id: postId });
      if (post) {
        return post;
      }
      await syncPostReference({ postId, channelId, replyId });
      return db.getPostWithRelations({ id: postId });
    },
  });
  return postQuery;
};

export const useGroupsHostedBy = (userId: string) => {
  return useQuery({
    queryKey: ['groupsHostedBy', userId],
    queryFn: async () => {
      // query backend for all groups the ship hosts
      const groups = await api.findGroupsHostedBy(userId);

      const clientGroups = api.toClientGroupsFromPreview(groups);
      // insert any we didn't already have
      await db.insertGroups({ groups: clientGroups, overWrite: false });

      const groupIds = clientGroups.map((g) => g.id);
      const groupPreviews = await db.getGroupPreviews(groupIds);
      return groupPreviews;
    },
    // this query's data rarely changes and is never invalidated elsewhere,
    // so we set stale time manually
    staleTime: 1000 * 60 * 30,
  });
};

export const useChannelSearchResults = (
  channelId: string,
  postIds: string[]
) => {
  return useQuery({
    queryKey: [['channelSearchResults', channelId, postIds]],
    queryFn: () => db.getChannelSearchResults({ channelId, postIds }),
  });
};

export const useChannelWithLastPostAndMembers = (
  options: db.GetChannelWithLastPostAndMembersOptions
) => {
  const tableDeps = useKeyFromQueryDeps(db.getChannelWithLastPostAndMembers);
  return useQuery({
    queryKey: ['channelWithLastPostAndMembers', tableDeps, options],
    queryFn: async () => {
      const channel = await db.getChannelWithLastPostAndMembers(options);
      return channel ?? null;
    },
  });
};

export const useChannel = (options: { id: string }) => {
  return useQuery({
    queryKey: [['channel', options]],
    queryFn: () => db.getChannelWithLastPostAndMembers(options),
  });
};

export const usePostWithThreadUnreads = (options: { id: string }) => {
  const tableDeps = useKeyFromQueryDeps(db.getPostWithRelations);
  return useQuery({
    queryKey: [['post', options], tableDeps],
    staleTime: Infinity,
    queryFn: () => db.getPostWithRelations(options),
  });
};

export const usePostWithRelations = (
  options: { id: string },
  initialData?: db.Post
) => {
  return useQuery({
    queryKey: ['post', options.id],
    staleTime: Infinity,
    ...(initialData ? { initialData } : {}),
    queryFn: () => db.getPostWithRelations(options),
  });
};
