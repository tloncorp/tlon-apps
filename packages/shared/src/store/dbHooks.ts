import {
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '../api';
import * as db from '../db';
import { getLevelFromVolumeMap } from '../urbit';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

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

export const useSettings = (options: { userId: string }) => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => db.getSettings(options.userId),
  });
};

export const useVolumeSettings = () => {
  return useQuery({
    queryKey: db.VOLUME_SETTINGS_QUERY_KEY,
    queryFn: db.getVolumeSettings,
  });
};

export const useActivitySeenMarker = () => {
  return useQuery({
    queryKey: db.ACTIVITY_SEEN_MARKER_QUERY_KEY,
    queryFn: () => db.getActivitySeenMarker(),
  });
};

export const useThreadIsMuted = ({
  channel,
  post,
}: {
  channel: db.Channel | undefined | null;
  post: db.Post;
}): boolean => {
  const { data: volumeSettings } = useVolumeSettings();

  const isMuted = useMemo(() => {
    if (!channel || post.parentId) return false;

    const { sourceId } = api.getThreadSource({ channel, post });
    if (volumeSettings) {
      const volumeMap = volumeSettings[sourceId];
      if (volumeMap) {
        return getLevelFromVolumeMap(volumeMap) === 'soft';
      }
    }

    return false;
  }, [channel, post, volumeSettings]);

  return isMuted;
};

export const useChannelIsMuted = (channel: db.Channel): boolean => {
  const { data: volumeSettings } = useVolumeSettings();

  const isMuted = useMemo(() => {
    const { sourceId } = api.getRootSourceFromChannel(channel);
    if (volumeSettings) {
      const volumeMap = volumeSettings[sourceId];
      if (volumeMap) {
        console.log(
          `got a volume map, is it muted?`,
          getLevelFromVolumeMap(volumeMap)
        );
        return getLevelFromVolumeMap(volumeMap) === 'soft';
      }
    }

    return false;
  }, [channel, volumeSettings]);

  return isMuted;
};

export const useGroupIsMuted = (group: db.Group): boolean => {
  const { data: volumeSettings } = useVolumeSettings();

  const isMuted = useMemo(() => {
    const sourceId = `group/${group.id}`;
    if (volumeSettings) {
      const volumeMap = volumeSettings[sourceId];
      if (volumeMap) {
        return getLevelFromVolumeMap(volumeMap) === 'soft';
      }
    }

    return false;
  }, [group, volumeSettings]);

  return isMuted;
};

export const usePushNotificationsSetting = () => {
  return useQuery({
    queryKey: db.PUSH_NOTIFICATIONS_SETTING_QUERY_KEY,
    queryFn: db.getPushNotificationsSetting,
  });
};

export const useContact = (options: { id: string }) => {
  const deps = useKeyFromQueryDeps(db.getContact);
  return useQuery({
    queryKey: [['contact', deps]],
    queryFn: () => db.getContact(options),
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

export const useGroupUnreadsCount = (groupId: string) => {
  const deps = useKeyFromQueryDeps(db.getGroupUnreadCount);
  return useQuery({
    queryKey: ['groupUnreadsCount', deps, groupId],
    queryFn: () => {
      if (!groupId) return null;

      return db.getGroupUnreadCount(groupId);
    },
  });
};

export const useGroupChannelUnreadsCount = (channelId: string) => {
  const deps = useKeyFromQueryDeps(db.getGroupChannelUnreadCount);
  return useQuery({
    queryKey: ['groupChannelUnreadsCount', deps, channelId],
    queryFn: () => {
      if (!channelId) return null;

      return db.getGroupChannelUnreadCount(channelId);
    },
  });
};

export const useUnreads = (options: db.GetUnreadsOptions) => {
  return useQuery({
    queryKey: ['unreads'],
    queryFn: () => db.getUnreads(options),
  });
};

export const useThreadUnread = ({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) => {
  const key = useKeyFromQueryDeps(db.getThreadActivity);
  return useQuery({
    queryKey: ['threadActivity', key, { channelId, postId }],
    queryFn: async () => {
      const activity = await db.getThreadActivity({ channelId, postId });
      return activity ?? null;
    },
  });
};

export const useActivityEvents = () => {
  const tablesKey = useKeyFromQueryDeps(db.getBucketedActivity);
  return useQuery({
    queryKey: ['activityEvents', tablesKey],
    queryFn: () => db.getBucketedActivity(),
  });
};

export const useActivityBucketCursors = () => {
  return useQuery({
    queryKey: db.ACTIVITY_BUCKET_CURSORS_QUERY_KEY,
    queryFn: () => db.getActivityBucketCursors(),
  });
};

export const useLatestActivityEvent = () => {
  const depsKey = useKeyFromQueryDeps(db.getLatestActivityEvent);
  return useQuery({
    queryKey: ['latestActivityEvent', depsKey],
    queryFn: () => db.getLatestActivityEvent(),
  });
};

export const useHaveUnseenActivity = () => {
  const { data: seenMarker } = useActivitySeenMarker();
  const { data: latestEvent } = useLatestActivityEvent();
  if (!latestEvent || seenMarker === null || seenMarker === undefined)
    return false;

  return latestEvent?.timestamp > seenMarker;
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
