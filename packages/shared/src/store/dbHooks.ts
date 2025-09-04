import {
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import * as api from '../api';
import { getMessagesFilter } from '../api';
import * as db from '../db';
import { GroupedChats } from '../db/types';
import { getConstants } from '../domain/constants';
import * as logic from '../logic';
import * as ub from '../urbit';
import { hasCustomS3Creds, hasHostingUploadCreds } from './storage';
import { syncChannelPreivews, syncPostReference } from './sync';
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

export const useSettings = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['settings', deps],
    queryFn: () => db.getSettings(),
  });
};

export const useCalmSettings = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['calmSettings', deps],
    queryFn: () =>
      db.getSettings().then((r) => ({
        disableAvatars: r?.disableAvatars ?? false,
        disableNicknames: r?.disableNicknames ?? false,
        disableRemoteContent: r?.disableRemoteContent ?? false,
      })),
  });
};

export const useMessagesFilter = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['messagesFilter', deps],
    queryFn: async () => {
      const settings = await db.getSettings();
      return getMessagesFilter(settings?.messagesFilter);
    },
  });
};

export const useActivitySeenMarker = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['activitySeenMarker', deps],
    queryFn: async () => {
      const settings = await db.getSettings();
      return settings?.activitySeenTimestamp ?? 1;
    },
  });
};

export const useCanUpload = () => {
  return (
    useQuery({
      queryKey: db.STORAGE_SETTINGS_QUERY_KEY,
      queryFn: async () => {
        const [config, credentials] = await Promise.all([
          db.storageConfiguration.getValue(),
          db.storageCredentials.getValue(),
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

export const useBaseUnread = () => {
  const depsKey = useKeyFromQueryDeps(db.getBaseUnread);
  return useQuery({
    queryKey: ['baseUnreads', depsKey],
    queryFn: async () => {
      return db.getBaseUnread();
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
    queryKey: ['groups', useKeyFromQueryDeps(db.getGroups, options)],
    queryFn: () => db.getGroups(options).then((r) => r ?? null),
  });
};

export const useGroup = ({ id }: { id?: string }) => {
  return useQuery({
    enabled: !!id,
    queryKey: [['group', id], useKeyFromQueryDeps(db.getGroup, id)],
    queryFn: () => {
      if (!id) {
        throw new Error('missing group id');
      }
      return db.getGroup({ id });
    },
  });
};

export const useGroupUnread = ({ groupId }: { groupId: string }) => {
  return useQuery({
    queryKey: [
      ['groupUnread', { groupId: groupId }],
      useKeyFromQueryDeps(db.getGroupUnread, { groupId: groupId }),
    ],
    queryFn: async () => db.getGroupUnread({ groupId: groupId }),
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
    queryKey: [
      ['group', channelId],
      useKeyFromQueryDeps(db.getGroupByChannel, channelId),
    ],
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
  const deps = useKeyFromQueryDeps(db.getGroup, groupId);
  const { data: group } = useGroup({ id: groupId });

  const { data: groupPreview, ...rest } = useQuery({
    queryKey: [['groupPreview', groupId], deps],
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: !!groupId && !group,
    queryFn: async () => await api.getGroupPreview(groupId),
    placeholderData: group ?? undefined,
  });

  useEffect(() => {
    if (groupId && !group && groupPreview) {
      db.insertUnjoinedGroups([groupPreview]);
    }
  }, [groupId, group, groupPreview]);

  return {
    data: group ?? groupPreview ?? undefined,
    ...rest,
  };
};

export const useSystemContacts = () => {
  const deps = useKeyFromQueryDeps(db.getSystemContacts);
  return useQuery({
    queryKey: ['systemContacts', deps],
    queryFn: () => db.getSystemContacts(),
  });
};

export const useSystemContactShortlist = () => {
  const deps = useKeyFromQueryDeps(db.getUninvitedSystemContactsShortlist);
  return useQuery({
    queryKey: ['systemContactsShortlist', deps],
    queryFn: () => db.getUninvitedSystemContactsShortlist(),
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
  const deps = useKeyFromQueryDeps(db.getChannelWithRelations, id);
  return useQuery({
    queryKey: [['channelPreview', id], deps],
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
  const deps = useKeyFromQueryDeps(db.getPostWithRelations, postId);
  const postQuery = useQuery({
    queryKey: [['postReference', postId], deps],
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

export const useGroupsHostedBy = (userId: string, disabled?: boolean) => {
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
    enabled: !disabled,
  });
};

export const useChannelSearchResults = (
  channelId: string,
  postIds: string[]
) => {
  const deps = useKeyFromQueryDeps(db.getChannelSearchResults, {
    channelId,
    postIds,
  });
  return useQuery({
    queryKey: [['channelSearchResults', channelId, postIds], deps],
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
      options.id,
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
    queryKey: [['post', options.id], tableDeps],
    staleTime: Infinity,
    queryFn: () => db.getPostWithRelations(options),
  });
};

export const usePostWithRelations = (
  options: { id: string } | null,
  initialData?: db.Post
) => {
  const deps = useKeyFromQueryDeps(db.getPostWithRelations, options?.id);
  return useQuery({
    enabled: options != null,
    queryKey: [['post', options?.id], deps],
    staleTime: Infinity,
    ...(initialData ? { initialData } : {}),
    queryFn: () => (options == null ? null : db.getPostWithRelations(options)),
  });
};

export const useAttestations = () => {
  const deps = useKeyFromQueryDeps(db.getAttestations);
  return useQuery({
    queryKey: ['attestations', deps],
    queryFn: () => db.getAttestations(),
  });
};

export const useCurrentUserAttestations = () => {
  const currentUserId = api.getCurrentUserId();
  const deps = useKeyFromQueryDeps(db.getUserAttestations);
  return useQuery({
    queryKey: ['attestations', deps],
    queryFn: () => db.getUserAttestations({ userId: currentUserId }),
  });
};

export const useCurrentUserPhoneAttestation = () => {
  const { data: attests } = useCurrentUserAttestations();
  const phoneAttest = useMemo(() => {
    return attests?.find((a) => a.type === 'phone' && a.status === 'verified');
  }, [attests]);

  return phoneAttest ?? null;
};

export const usePersonalGroup = () => {
  const deps = useKeyFromQueryDeps(db.getPersonalGroup);
  return useQuery({
    queryKey: ['personalGroup', deps],
    queryFn: async () => {
      const currentUserId = api.getCurrentUserId();
      const group = await db.getPersonalGroup();
      return logic.personalGroupIsValid({ group, currentUserId })
        ? group
        : null;
    },
  });
};

export const useWayfindingCompletion = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['wayfindingCompletion', deps],
    queryFn: async () => {
      const settings = await db.getSettings();
      return {
        completedSplash: settings?.completedWayfindingSplash,
        completedPersonalGroupTutorial: settings?.completedWayfindingTutorial,
      };
    },
  });
};

export const useShowWebSplashModal = () => {
  const { data: wayfinding, isLoading } = useWayfindingCompletion();
  const { data: personalGroup } = usePersonalGroup();

  // Disable splash modal during e2e tests
  try {
    const constants = getConstants();
    if (constants.DISABLE_SPLASH_MODAL) {
      return false;
    }
  } catch (e) {
    // Constants not available (e.g., in test environment)
    // Continue with normal behavior
  }

  return Boolean(
    personalGroup && !isLoading && !(wayfinding?.completedSplash ?? true)
  );
};

export const useShowChatInputWayfinding = (channelId: string) => {
  const wayfindingProgress = db.wayfindingProgress.useValue();
  const isCorrectChan = useMemo(() => {
    return logic.isPersonalChatChannel(channelId);
  }, [channelId]);

  return isCorrectChan && !wayfindingProgress.tappedChatInput;
};

export const useShowCollectionAddTooltip = (channelId: string) => {
  const wayfindingProgress = db.wayfindingProgress.useValue();
  const isCorrectChan = useMemo(() => {
    return logic.isPersonalCollectionChannel(channelId);
  }, [channelId]);
  return isCorrectChan && !wayfindingProgress.tappedAddCollection;
};

export const useShowNotebookAddTooltip = (channelId: string) => {
  const wayfindingProgress = db.wayfindingProgress.useValue();
  const isCorrectChan = useMemo(() => {
    return logic.isPersonalNotebookChannel(channelId);
  }, [channelId]);
  return isCorrectChan && !wayfindingProgress.tappedAddNote;
};

export const useThemeSettings = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['themeSettings', deps],
    queryFn: async () => {
      const settings = await db.getSettings();
      return settings?.theme || null;
    },
  });
};

export const useTelemetryEnabled = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['enableTelemetry', deps],
    queryFn: async () => {
      const settings = await db.getSettings();
      return settings?.enableTelemetry ?? false;
    },
  });
};

export const useTelemetrySettings = () => {
  const deps = useKeyFromQueryDeps(db.getSettings);
  return useQuery({
    queryKey: ['telemetrySettings', deps],
    queryFn: async () => {
      const settings = await db.getSettings();
      return {
        enableTelemetry: settings?.enableTelemetry,
        logActivity: settings?.logActivity,
      };
    },
  });
};
