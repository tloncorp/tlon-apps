import {
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '../api';
import * as db from '../db';
import { GroupedChats } from '../db/types';
import * as ub from '../urbit';
import { hasCustomS3Creds, hasHostingUploadCreds } from './storage';
import {
  syncChannelPreivews,
  syncGroupPreviews,
  syncPostReference,
} from './sync';
import { keyFromQueryDeps, useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export * from './useChannelSearch';

export type CustomQueryConfig<T> = Pick<
  UseQueryOptions<T, Error, T>,
  'enabled'
>;

export const useAllChannels = ({ enabled }: { enabled?: boolean }) => {
  const querykey = useKeyFromQueryDeps(db.getAllChannels);
  return useQuery({
    queryKey: ['allChannels', querykey],
    queryFn: () => db.getAllChannels(),
    enabled,
  });
};

export const useCurrentChats = (
  queryConfig?: CustomQueryConfig<GroupedChats>
): UseQueryResult<GroupedChats | null> => {
  return useQuery({
    queryFn: async () => {
      return db.getChats();
    },
    queryKey: ['currentChats', useKeyFromQueryDeps(db.getChats)],
    ...queryConfig,
  });
};

export const useUnjoinedGroupChannels = (groupId: string) => {
  const deps = useKeyFromQueryDeps(db.getUnjoinedGroupChannels);
  return useQuery({
    queryKey: [['unjoinedChannels', groupId], deps],
    queryFn: async () => {
      if (!groupId) {
        return [];
      }
      const unjoined = await db.getUnjoinedGroupChannels(groupId);
      return unjoined;
    },
  });
};

export const usePins = (
  queryConfig?: CustomQueryConfig<db.Pin[]>
): UseQueryResult<db.Pin[] | null> => {
  return useQuery({
    queryFn: async () => {
      return db.getPins();
    },
    queryKey: ['pins', useKeyFromQueryDeps(db.getPins)],
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

export const useDidShowBenefitsSheet = () => {
  return useQuery({
    queryKey: db.SHOW_BENEFITS_SHEET_QUERY_KEY,
    queryFn: db.getDidShowBenefitsSheet,
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
  }).data;
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

export const useUnreadsCountWithoutMuted = () => {
  return useQuery({
    queryKey: [
      'unreadsCount',
      useKeyFromQueryDeps(db.getUnreadsCountWithoutMuted),
    ],
    queryFn: () => db.getUnreadsCountWithoutMuted({}),
  });
};

export const useGroupVolumeLevel = (groupId: string) => {
  const deps = useKeyFromQueryDeps(db.getGroupVolumeSetting);
  return useQuery({
    queryKey: ['groupVolumeLevel', deps, groupId],
    queryFn: () => db.getGroupVolumeSetting({ groupId }),
  });
};

export const useChannelVolumeLevel = (channelId: string) => {
  const deps = useKeyFromQueryDeps(db.getChannelVolumeSetting);
  return useQuery({
    queryKey: ['channelVolumeLevel', deps, channelId],
    queryFn: () => db.getChannelVolumeSetting({ channelId }),
  });
};

export const useVolumeExceptions = () => {
  const deps = useKeyFromQueryDeps(db.getVolumeExceptions);
  return useQuery({
    queryKey: ['volumeExceptions', deps],
    queryFn: () => db.getVolumeExceptions(),
  });
};

export const useBaseVolumeLevel = (): ub.NotificationLevel => {
  const deps = useKeyFromQueryDeps(db.getVolumeSetting);

  const { data } = useQuery({
    queryKey: ['baseVolumeLevel', deps],
    queryFn: () => db.getVolumeSetting('base'),
  });

  if (data) {
    return data.level;
  }

  return 'medium';
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

export const useLiveGroupUnread = (unread: db.GroupUnread | null) => {
  const depsKey = useMemo(
    () => (unread ? keyFromQueryDeps(db.getGroupUnread) : null),
    [unread]
  );

  return useQuery({
    queryKey: [
      'liveUnreadCount',
      depsKey,
      'group',
      unread ? unread.groupId : null,
    ],
    queryFn: async () => {
      if (unread) {
        return db.getGroupUnread({ groupId: unread.groupId ?? '' });
      }
      return null;
    },
  });
};

export const useLiveUnread = (
  unread: db.ChannelUnread | db.ThreadUnreadState | db.GroupUnread | null
) => {
  const isGroup = useMemo(() => unread && 'groupId' in unread, [unread]);
  const isThread = useMemo(() => unread && 'threadId' in unread, [unread]);
  const threadUnread = useLiveThreadUnread(
    isThread ? (unread as db.ThreadUnreadState) : null
  );
  const channelUnread = useLiveChannelUnread(
    isThread ? null : (unread as db.ChannelUnread | null)
  );
  const groupUnread = useLiveGroupUnread(
    isGroup ? (unread as db.GroupUnread) : null
  );
  return isThread ? threadUnread : isGroup ? groupUnread : channelUnread;
};

export const useGroups = (options: db.GetGroupsOptions) => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => db.getGroups(options).then((r) => r ?? null),
  });
};

export const useGroup = ({ id }: { id?: string }) => {
  return useQuery({
    enabled: !!id,
    queryKey: [['group', { id }], useKeyFromQueryDeps(db.getGroup, { id })],
    queryFn: () => {
      if (!id) {
        throw new Error('missing group id');
      }
      return db.getGroup({ id });
    },
  });
};

export const useJoinedGroupsCount = () => {
  const deps = useKeyFromQueryDeps(db.getJoinedGroupsCount);
  return useQuery({
    queryKey: ['joinedGroupsCount', deps],
    queryFn: () => db.getJoinedGroupsCount(),
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
    queryKey: [
      ['memberRoles', chatId, userId],
      useKeyFromQueryDeps(db.getChatMember),
    ],
    queryFn: () => db.getChatMember({ chatId, contactId: userId }),
  });

  const memberRoles = useMemo(
    () => chatMember?.roles.map((role) => role.roleId) ?? [],
    [chatMember]
  );

  return memberRoles;
};

export const useGroupPreview = (groupId: string) => {
  return useQuery({
    queryKey: ['groupPreview', groupId],
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async () => {
      const [preview] = await syncGroupPreviews([groupId]);
      return preview;
    },
  });
};

export const useUserContacts = () => {
  const deps = useKeyFromQueryDeps(db.getUserContacts);
  return useQuery({
    queryKey: ['userContacts', deps],
    queryFn: () => db.getUserContacts(),
  });
};

export const useSuggestedContacts = () => {
  const deps = useKeyFromQueryDeps(db.getSuggestedContacts);
  return useQuery({
    queryKey: ['suggestedContacts', deps],
    queryFn: () => db.getSuggestedContacts(),
  });
};

export const useChannelPreview = ({ id }: { id: string }) => {
  return useQuery({
    queryKey: ['channelPreview', id],
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async () => {
      const [channel] = await syncChannelPreivews([id]);
      return channel;
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
      // insert any we didn't already have
      await db.insertGroupPreviews({ groups });

      const groupIds = groups.map((g) => g.id);
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

export const useChannel = (options: { id?: string }) => {
  const { id } = options;
  return useQuery({
    enabled: !!id,
    queryKey: [
      'channelWithRelations',
      useKeyFromQueryDeps(db.getChannelWithRelations),
      options,
    ],
    queryFn: () => {
      if (!id) {
        throw new Error('missing channel id');
      }
      return db.getChannelWithRelations({ id });
    },
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
