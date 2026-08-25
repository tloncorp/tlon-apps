import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { Story } from '@tloncorp/api/urbit';
import {
  configurationFromChannel,
  createDevLogger,
  useChannelContext,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCanUpload } from '@tloncorp/shared/store';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { BackHandler } from 'react-native';

import { useAgentGroupOnboardingLock } from '../../hooks/useAgentGroupOnboardingLock';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import { usePushNotifTapTelemetry } from '../../hooks/usePushNotifTapTelemetry';
import type { RootStackParamList } from '../../navigation/types';
import {
  createTypedReset,
  getTopLevelTabRoute,
  useRootNavigation,
} from '../../navigation/utils';
import {
  AttachmentProvider,
  Channel,
  ChatOptionsProvider,
  InviteUsersSheet,
  useIsWindowNarrow,
} from '../../ui';
import {
  shouldAcknowledgeAgentOnboardingLanding,
  shouldRestoreAgentOnboardingFallback,
} from './agentOnboardingLanding';

const logger = createDevLogger('ChannelScreen', false);

type Props = NativeStackScreenProps<RootStackParamList, 'Channel'>;

export default function ChannelScreen(props: Props) {
  const {
    channelId,
    selectedPostId,
    startDraft,
    groupId: routeGroupId,
  } = props.route.params ?? {
    channelId: '',
    selectedPostId: '',
    startDraft: false,
    groupId: undefined,
  };

  const onboardingLanding = db.agentOnboardingLanding.useValue();
  const resetNavigation = useMemo(
    () => createTypedReset(props.navigation),
    [props.navigation]
  );
  useEffect(() => {
    if (!shouldRestoreAgentOnboardingFallback(onboardingLanding, channelId)) {
      return;
    }
    // The legacy splash is still covering the navigator. Restore its normal
    // Home destination underneath before the fallback can be completed.
    resetNavigation([getTopLevelTabRoute('ChatList')]);
    void db.agentOnboardingLanding.resetValue().catch((error) => {
      logger.trackError('Failed to clear agent onboarding fallback route', {
        error,
        ...onboardingLanding,
      });
    });
  }, [channelId, onboardingLanding, resetNavigation]);
  useEffect(() => {
    if (
      !shouldAcknowledgeAgentOnboardingLanding(onboardingLanding, channelId)
    ) {
      return;
    }

    // The destination is mounted, so the full-screen onboarding cover can
    // disappear without waiting for the bounded handoff timeout.
    void db.agentOnboardingLanding.resetValue().catch((error) => {
      logger.trackError('Failed to acknowledge agent onboarding landing', {
        error,
        ...onboardingLanding,
      });
    });
  }, [channelId, onboardingLanding]);
  const [currentChannelId, setCurrentChannelId] = React.useState(channelId);

  useEffect(() => {
    setCurrentChannelId(channelId);
  }, [channelId]);

  const {
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    editingPost,
    setEditingPost,
    channel,
    group,
    groupIsLoading,
  } = useChannelContext({
    channelId: currentChannelId,
    draftKey: currentChannelId,
  });

  const groupId = channel?.groupId ?? group?.id;
  const agentOnboardingGroupId = routeGroupId ?? groupId;
  const agentOnboarding = useAgentGroupOnboardingLock(agentOnboardingGroupId);
  const agentOnboardingNavigationLocked =
    agentOnboarding.locked ||
    Boolean(agentOnboardingGroupId && agentOnboarding.isLoading);
  const agentGroupAgents = db.agentGroupAgents.useValue();
  const agentShipId = groupId ? agentGroupAgents[groupId] : undefined;
  const latestChannelSequenceNum =
    store.useChannelLatestSequenceNum(currentChannelId);

  useEffect(() => {
    const provision = agentOnboarding.marker?.provision;
    if (
      !groupId ||
      !agentShipId ||
      !provision ||
      latestChannelSequenceNum == null ||
      agentOnboarding.marker?.provisionAcknowledgedAt
    ) {
      return;
    }
    let cancelled = false;
    void db
      .getChanPosts({ channelId: currentChannelId })
      .then((channelPosts) => {
        if (cancelled) return;
        const acknowledged = channelPosts.some(
          (post) =>
            post.authorId === agentShipId &&
            api.findPostBlobEntry(post.blob, 'tlon-agent-provision-ack')
              ?.provisionId === provision.provisionId
        );
        if (!acknowledged) return;
        return db.agentGroupOnboardingLocks.setValue((current) => {
          const lock = current[groupId];
          if (!lock || lock.provisionAcknowledgedAt) return current;
          return {
            ...current,
            [groupId]: { ...lock, provisionAcknowledgedAt: Date.now() },
          };
        });
      })
      .catch((error) => {
        if (!cancelled) {
          logger.trackError('Failed to reconcile agent provision receipt', {
            error,
            groupId,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    agentOnboarding.marker,
    agentShipId,
    currentChannelId,
    groupId,
    latestChannelSequenceNum,
  ]);

  const channelIsPending = !channel || channel.isPendingChannel;
  useFocusEffect(
    useCallback(() => {
      // Mark the channel as visited when we unfocus/leave this screen
      if (!channelIsPending) {
        store.markChannelVisited(channelId);
      }

      // Mark wayfinding channels as visited if needed
      store.markPotentialWayfindingChannelVisit(channelId);
    }, [channelId, channelIsPending])
  );

  const groupIsNew = group?.isNew;
  useFocusEffect(
    useCallback(() => {
      // Mark group visited on enter if new
      if (groupId && groupIsNew) {
        store.markGroupVisited(groupId);
      }
    }, [groupId, groupIsNew])
  );

  useFocusEffect(
    useCallback(() => {
      if (groupId) {
        // Update the last visited channel in the group so we can return to it
        // when we come back to the group
        db.lastVisitedChannelId(groupId).setValue(channelId);
      }
    }, [groupId, channelId])
  );

  const activityCapabilitiesEpoch = useSyncExternalStore(
    api.onActivityCapabilitiesChange,
    api.getActivityCapabilitiesEpoch
  );
  // A cached notes channel can mount before app-info resolves notes activity
  // support. In that case the initial per-note unread sync intentionally
  // returns no answer; retry once the capability becomes available.
  const notesActivityCapabilitiesEpoch =
    channel?.type === 'notes' ? activityCapabilitiesEpoch : 0;

  useEffect(() => {
    if (channelIsPending) {
      return;
    }

    const abortController = new AbortController();
    void store
      .syncChannelThreadUnreads(channelId, {
        priority: store.SyncPriority.High,
        abortSignal: abortController.signal,
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          logger.error('Failed to sync channel thread unreads', error);
        }
      });

    return () => abortController.abort();
  }, [channelIsPending, channelId, notesActivityCapabilitiesEpoch]);

  // Snapshot unread state once per focused entry so the divider does not move
  // as the channel is marked read.
  const [initialChannelUnreadSnapshot, setInitialChannelUnreadSnapshot] =
    React.useState<{
      channelId: string;
      unread: db.ChannelUnread | null;
    } | null>(null);
  const [unreadSnapshotIsFresh, setUnreadSnapshotIsFresh] =
    React.useState(false);
  const [clearedCursor, setClearedCursor] = React.useState(false);
  const isFocused = useIsFocused();
  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setUnreadSnapshotIsFresh(false);

      async function initializeChannelUnread() {
        let unread: db.ChannelUnread | null | undefined;
        try {
          unread = await db.getChannelUnread({ channelId: currentChannelId });
        } catch (error) {
          logger.trackError('failed to initialize channel unread', error);
        }

        if (isCurrent) {
          setInitialChannelUnreadSnapshot({
            channelId: currentChannelId,
            unread: unread ?? null,
          });
          setUnreadSnapshotIsFresh(true);
        }
      }

      void initializeChannelUnread();

      return () => {
        isCurrent = false;
        setUnreadSnapshotIsFresh(false);
      };
    }, [currentChannelId])
  );

  const unreadDidInitialize =
    isFocused &&
    unreadSnapshotIsFresh &&
    initialChannelUnreadSnapshot?.channelId === currentChannelId;
  useEffect(() => {
    if (unreadDidInitialize) {
      // Keep the retained visit's query mode stable while its replacement
      // unread snapshot loads, then allow the fresh cursor to take over.
      setClearedCursor(false);
    }
  }, [unreadDidInitialize]);
  // Retain the prior focused entry's snapshot while its replacement loads.
  // This preserves Channel-local draft state without enabling unread work
  // until the new snapshot is ready.
  const initialChannelUnread =
    initialChannelUnreadSnapshot?.channelId === currentChannelId
      ? initialChannelUnreadSnapshot.unread
      : null;

  const {
    navigateToImage,
    navigateToPost,
    navigateToRef,
    navigateToSearch,
    navigateToContextLensRuns,
    navigateToContextLensRun,
  } = useChannelNavigation({ channelId: currentChannelId });
  const { navigation } = useRootNavigation();
  const navigationRef = useRef(props.navigation);
  const isWindowNarrow = useIsWindowNarrow();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);

  useEffect(() => {
    navigationRef.current.setOptions({
      gestureEnabled: !agentOnboardingNavigationLocked,
    });
  }, [agentOnboardingNavigationLocked]);

  useFocusEffect(
    useCallback(() => {
      if (!agentOnboardingNavigationLocked) return;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => true
      );
      return () => subscription.remove();
    }, [agentOnboardingNavigationLocked])
  );

  const { performGroupAction } = useGroupActions();

  const unreadCursor =
    channel &&
    initialChannelUnread &&
    (initialChannelUnread.countWithoutThreads ?? 0) > 0
      ? initialChannelUnread.firstUnreadPostId
      : undefined;
  // Channel navigation establishes a new cursor scope.
  useEffect(() => {
    setClearedCursor(false);
  }, [currentChannelId]);

  // A newly selected post establishes a new cursor scope. Clearing an existing
  // selection below must not immediately restore the cursor we just retired.
  useEffect(() => {
    if (selectedPostId) {
      setClearedCursor(false);
    }
  }, [selectedPostId]);

  const handleScrollToBottom = useCallback(() => {
    setClearedCursor(true);
    if (selectedPostId) {
      props.navigation.setParams({ selectedPostId: undefined });
    }
  }, [props.navigation, selectedPostId]);

  const channelConfiguration = useMemo(
    () => configurationFromChannel(channel),
    [channel]
  );
  const { data: showDeleteMarkers = false } = store.useShowDeleteMarkers();
  const includeDeletedPosts =
    channelConfiguration?.includeDeletedPosts && showDeleteMarkers;
  const requestedCursor = selectedPostId || unreadCursor;
  const { data: cursorPost } = store.usePostWithRelations(
    requestedCursor ? { id: requestedCursor } : null
  );
  const cursorPostIsHidden = Boolean(
    requestedCursor && !includeDeletedPosts && cursorPost?.isDeleted
  );
  const cursor = cursorPostIsHidden ? undefined : requestedCursor;

  useEffect(() => {
    if (cursorPostIsHidden) {
      setClearedCursor(true);
      if (selectedPostId) {
        props.navigation.setParams({ selectedPostId: undefined });
      }
    }
  }, [cursorPostIsHidden, props.navigation, selectedPostId]);

  useEffect(() => {
    if (channel?.id) {
      logger.sensitiveCrumb(`channelId: ${channel?.id}`, `cursor: ${cursor}`);
    }
  }, [channel?.id, cursor]);

  const {
    posts,
    query: postsQuery,
    loadNewer,
    loadOlder,
    isLoading: isLoadingPosts,
  } = store.useChannelPosts({
    // Capture the unread cursor before loading posts or mounting Channel,
    // which can mark the channel read as soon as cached posts are available.
    enabled: unreadDidInitialize && !!channel && !channel?.isPendingChannel,
    channelId: currentChannelId,
    count: 30,
    filterDeleted: !includeDeletedPosts,
    ...(cursor && !clearedCursor
      ? {
          mode: 'around',
          cursorPostId: cursor,
          firstPageCount: 30,
        }
      : {
          mode: 'newest',
          firstPageCount: 50,
        }),
  });

  const oldestPage = postsQuery.data?.pages.at(-1);
  const oldestPageHasOnlyDeletedPosts = Boolean(
    !includeDeletedPosts &&
    oldestPage?.posts.length &&
    oldestPage.posts.every((post) => post.isDeleted)
  );

  useEffect(() => {
    // This recovers a failed around-cursor query by issuing a newest query.
    // Successful queries that temporarily omit the anchor recover in PostList.
    if (
      unreadCursor &&
      !selectedPostId &&
      !clearedCursor &&
      postsQuery.isError &&
      !isLoadingPosts
    ) {
      logger.log('unread cursor failed; falling back to newest posts', {
        channelId: currentChannelId,
        unreadCursor,
      });
      setClearedCursor(true);
    }
  }, [
    clearedCursor,
    currentChannelId,
    isLoadingPosts,
    postsQuery.isError,
    selectedPostId,
    unreadCursor,
  ]);

  useEffect(() => {
    // Make sure the initial page can fill the screen; otherwise the visual
    // start boundary may never move far enough to request another older page.
    // Likewise, keep going when a page contains only hidden delete markers,
    // since adding no visible rows will not retrigger the boundary callback.
    const ENOUGH_POSTS_TO_FILL_SCREEN = 20;
    if (
      !postsQuery.isFetching &&
      postsQuery.hasNextPage &&
      unreadDidInitialize &&
      (!posts ||
        posts.length < ENOUGH_POSTS_TO_FILL_SCREEN ||
        oldestPageHasOnlyDeletedPosts)
    ) {
      loadOlder();
    }
  }, [
    loadOlder,
    oldestPageHasOnlyDeletedPosts,
    posts,
    postsQuery,
    unreadDidInitialize,
  ]);

  const filteredPosts = useMemo(
    () => (includeDeletedPosts ? posts : posts?.filter((p) => !p.isDeleted)),
    [posts, includeDeletedPosts]
  );
  usePushNotifTapTelemetry({
    channelId: currentChannelId,
    posts: filteredPosts,
    isFocused,
    cursorPostId: cursor || null,
    channelMode: cursor && !clearedCursor ? 'around' : 'newest',
  });

  const handleDeletePost = useCallback(
    async (post: db.Post) => {
      if (!channel) {
        throw new Error('Tried to delete message before channel loaded');
      }
      await store.deleteFailedPost({
        post,
      });
    },
    [channel]
  );

  const handleRetrySend = useCallback(
    async (post: db.Post) => {
      if (!channel) {
        throw new Error('Tried to retry send before channel loaded');
      }

      if (post.deliveryStatus === 'failed') {
        await store.retrySendPost({
          channel,
          post,
        });
      }

      if (post.editStatus === 'failed' && post.lastEditContent) {
        const postFromDb = await db.getPost({ postId: post.id });
        let metadata: db.PostMetadata | undefined;
        if (post.lastEditTitle) {
          metadata = {
            title: post.lastEditTitle ?? undefined,
          };
        }

        if (post.lastEditImage) {
          metadata = {
            ...metadata,
            image: post.lastEditImage ?? undefined,
          };
        }

        await store.editPost({
          post,
          content: JSON.parse(postFromDb?.lastEditContent as string) as Story,
          parentId: post.parentId ?? undefined,
          metadata,
        });
      }

      if (post.deleteStatus === 'failed') {
        await store.deletePost({
          post,
        });
      }
    },
    [channel]
  );

  const handleChatDetailsPressed = useCallback(() => {
    const groupId = channel?.groupId ?? group?.id;
    if (!groupId) return;

    const isSingleChannelGroup = group?.channels?.length === 1;
    // Single-channel groups show group details; multi-channel show channel details
    if (isSingleChannelGroup) {
      navigationRef.current.navigate('ChatDetails', {
        chatType: 'group',
        chatId: groupId,
        groupId,
      });
    } else if (channel) {
      navigationRef.current.navigate('ChatDetails', {
        chatType: 'channel',
        chatId: channel.id,
        groupId,
      });
    }
  }, [channel, group, navigationRef]);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      navigationRef.current.push('DM', { channelId: dmChannel.id });
    },
    [navigationRef]
  );

  const handleMarkRead = useCallback(async () => {
    if (unreadDidInitialize && channel && !channel.isPendingChannel) {
      store.markChannelRead({
        id: channel.id,
        groupId: channel.groupId ?? undefined,
      });
    }
  }, [channel?.type, channel?.id, channel?.groupId, unreadDidInitialize]);

  const handlePressInvite = useCallback(
    (groupId: string) => {
      if (isWindowNarrow) {
        // Mobile: Use navigation to screen
        navigation.navigate('InviteUsers', { groupId });
      } else {
        // Desktop: Use sheet
        setInviteSheetGroup(groupId);
      }
    },
    [isWindowNarrow, navigation]
  );

  const canUpload = useCanUpload();

  const chatOptionsNavProps = useChatSettingsNavigation();

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      navigationRef.current.navigate('UserProfile', {
        userId,
        groupId,
        channelId: currentChannelId,
      });
    },
    [navigationRef, groupId, currentChannelId]
  );

  const handleGoToGroupSettings = useCallback(() => {
    if (group) {
      navigationRef.current.navigate('GroupSettings', {
        state: {
          routes: [{ name: 'GroupMembers', params: { groupId: group.id } }],
          index: 0,
        },
      });
    }
  }, [group, navigationRef]);

  const initialChat = useMemo(
    () =>
      ({
        type: 'channel',
        id: currentChannelId,
        groupId: routeGroupId ?? channel?.groupId ?? undefined,
      }) as const,
    [currentChannelId, routeGroupId, channel?.groupId]
  );

  if (
    !channel ||
    initialChannelUnreadSnapshot?.channelId !== currentChannelId
  ) {
    return null;
  }

  return (
    <ChatOptionsProvider
      initialChat={initialChat}
      {...chatOptionsNavProps}
      onPressInvite={handlePressInvite}
    >
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <Channel
          key={currentChannelId}
          channel={channel}
          initialChannelUnread={
            clearedCursor || cursorPostIsHidden
              ? undefined
              : initialChannelUnread
          }
          isLoadingPosts={isLoadingPosts}
          loadPostsError={postsQuery.error}
          hasNewerPosts={postsQuery.hasPreviousPage}
          hasOlderPosts={postsQuery.hasNextPage}
          group={group}
          groupIsLoading={groupIsLoading}
          posts={filteredPosts ?? null}
          selectedPostId={
            clearedCursor || cursorPostIsHidden ? undefined : selectedPostId
          }
          goBack={navigationRef.current.goBack}
          disableBackButton={agentOnboardingNavigationLocked}
          goToPost={navigateToPost}
          goToMediaViewer={navigateToImage}
          goToChatDetails={handleChatDetailsPressed}
          goToSearch={navigateToSearch}
          goToContextLensRuns={navigateToContextLensRuns}
          goToContextLensRun={navigateToContextLensRun}
          goToDm={handleGoToDm}
          goToUserProfile={handleGoToUserProfile}
          goToGroupSettings={handleGoToGroupSettings}
          onLoadNewerPosts={loadNewer}
          onLoadOlderPosts={loadOlder}
          onPressRef={navigateToRef}
          markRead={handleMarkRead}
          onGroupAction={performGroupAction}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          onPressDelete={handleDeletePost}
          onPressRetrySend={handleRetrySend}
          onPressRetryLoad={postsQuery.refetch}
          setEditingPost={setEditingPost}
          negotiationMatch={negotiationStatus.matchedOrPending}
          startDraft={startDraft}
          onPressScrollToBottom={handleScrollToBottom}
        />
      </AttachmentProvider>
      {!isWindowNarrow && (
        <InviteUsersSheet
          open={inviteSheetGroup !== null}
          onOpenChange={(open) => {
            if (!open) {
              setInviteSheetGroup(null);
            }
          }}
          groupId={inviteSheetGroup ?? undefined}
          onInviteComplete={() => setInviteSheetGroup(null)}
        />
      )}
    </ChatOptionsProvider>
  );
}
