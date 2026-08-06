import {
  StackActions,
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
} from 'react';
import { BackHandler } from 'react-native';

import { useAgentOnboardingLock } from '../../hooks/useAgentOnboardingLock';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import { usePushNotifTapTelemetry } from '../../hooks/usePushNotifTapTelemetry';
import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  AttachmentProvider,
  Channel,
  ChatOptionsProvider,
  InviteUsersSheet,
  useIsWindowNarrow,
} from '../../ui';

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

  // Includes the route param so the id exists before the first sync lands —
  // the setup lock must engage on the loading window too.
  const groupId = channel?.groupId ?? group?.id ?? routeGroupId;

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

  const channelThreadAbortController = useRef<AbortController | null>(
    new AbortController()
  );

  useEffect(() => {
    if (!channelIsPending) {
      if (channelThreadAbortController.current) {
        channelThreadAbortController.current.abort();
      }
      channelThreadAbortController.current = new AbortController();
      store.syncChannelThreadUnreads(channelId, {
        priority: store.SyncPriority.High,
        abortSignal: channelThreadAbortController.current?.signal,
      });
    }
  }, [channelIsPending, channelId]);

  // for the unread channel divider, we care about the unread state when you enter but don't want it to update over
  // time
  const [initialChannelUnread, setInitialChannelUnread] =
    React.useState<db.ChannelUnread | null>(null);
  const [unreadDidInitialize, setUnreadDidInitialize] = React.useState(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    async function initializeChannelUnread() {
      const unread = await db.getChannelUnread({ channelId: currentChannelId });
      setInitialChannelUnread(unread ?? null);
      setUnreadDidInitialize(true);
    }

    if (isFocused) {
      initializeChannelUnread();
    }
  }, [currentChannelId, isFocused]);

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

  /**
   * Where "back" goes, decided at press time rather than by what the stack
   * happened to hold on the way in. A group can grow around the user while
   * they sit in a channel — agent onboarding lands them in a single-channel
   * group and the bot adds a notebook during setup — so a plain pop would
   * skip a channel list that now exists. If the group has more than one
   * channel, back means "up to the channel list": popTo pops to the list
   * when it's already behind this screen and replaces this screen with it
   * when it isn't (same idiom as useNavigateBackFromPost).
   */
  const handleGoBack = useCallback(() => {
    if (isWindowNarrow && groupId && (group?.channels?.length ?? 0) > 1) {
      navigationRef.current.dispatch(
        StackActions.popTo('GroupChannels', { groupId })
      );
      return;
    }
    navigationRef.current.goBack();
  }, [group?.channels?.length, groupId, isWindowNarrow]);

  // The first-run group holds its chrome until the agent finishes the
  // setup; the lock reads live state, so it releases when the config syncs.
  const setupLocked = useAgentOnboardingLock(groupId, group?.description);

  // The setup's output notebook is the owner's channel: create it the
  // moment the group's config gains a job, so the agent's first run has a
  // place to post into — the agent itself never hosts channels. The owner
  // is being held in this very channel while the build runs, which is what
  // makes this the reliable place to react from.
  useEffect(() => {
    if (group) {
      store.ensureAgentNotebookForGroup(group).catch(() => {
        // Logged inside; the agent falls back to chat output.
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.description, group?.channels?.length]);

  // The header button is only one exit; the swipe-back gesture and the
  // Android hardware button are the others. All honor the lock, and all
  // come back when it releases.
  useEffect(() => {
    navigationRef.current.setOptions({ gestureEnabled: !setupLocked });
  }, [setupLocked]);
  useEffect(() => {
    if (!setupLocked) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true
    );
    return () => subscription?.remove?.();
  }, [setupLocked]);

  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);

  const { performGroupAction } = useGroupActions();

  const cursor = useMemo(() => {
    if (!channel) {
      return undefined;
    }
    const firstUnreadId =
      initialChannelUnread &&
      (initialChannelUnread.countWithoutThreads ?? 0) > 0 &&
      initialChannelUnread?.firstUnreadPostId;
    return selectedPostId || firstUnreadId;
    // We only want this to rerun when the channel is loaded for the first time OR if
    // the selected post route param changes
    // eslint-disable-next-line
  }, [!!channel, initialChannelUnread, selectedPostId]);

  useEffect(() => {
    if (channel?.id) {
      logger.sensitiveCrumb(`channelId: ${channel?.id}`, `cursor: ${cursor}`);
    }
  }, [channel?.id, cursor]);

  // If scroll to bottom is pressed, it's most straighforward to ignore
  // existing cursor
  const [clearedCursor, setClearedCursor] = React.useState(false);

  // But if a new post is selected, we should mark the cursor
  // as uncleared
  useEffect(() => {
    setClearedCursor(false);
  }, [selectedPostId]);

  const handleScrollToBottom = useCallback(() => {
    setClearedCursor(true);
  }, []);

  const channelConfiguration = useMemo(
    () => configurationFromChannel(channel),
    [channel]
  );

  const {
    posts,
    query: postsQuery,
    loadNewer,
    loadOlder,
    isLoading: isLoadingPosts,
  } = store.useChannelPosts({
    enabled: !!channel && !channel?.isPendingChannel,
    channelId: currentChannelId,
    count: 30,
    filterDeleted: !channelConfiguration?.includeDeletedPosts,
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

  useEffect(() => {
    // make sure we always load enough posts to fill the screen or
    // onScrollEndReached might not fire properly
    const ENOUGH_POSTS_TO_FILL_SCREEN = 20;
    if (
      !postsQuery.isFetching &&
      postsQuery.hasNextPage &&
      unreadDidInitialize &&
      (!posts || posts.length < ENOUGH_POSTS_TO_FILL_SCREEN)
    ) {
      loadOlder();
    }
  }, [postsQuery, posts, loadOlder, unreadDidInitialize]);

  const filteredPosts = useMemo(
    () =>
      channelConfiguration?.includeDeletedPosts
        ? posts
        : posts?.filter((p) => !p.isDeleted),
    [posts, channelConfiguration?.includeDeletedPosts]
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
    if (channel && !channel.isPendingChannel) {
      store.markChannelRead({
        id: channel.id,
        groupId: channel.groupId ?? undefined,
      });
    }
  }, [channel?.type, channel?.id, channel?.groupId]);

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

  if (!channel) {
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
            clearedCursor ? undefined : initialChannelUnread
          }
          isLoadingPosts={isLoadingPosts}
          loadPostsError={postsQuery.error}
          hasNewerPosts={postsQuery.hasPreviousPage}
          hasOlderPosts={postsQuery.hasNextPage}
          group={group}
          groupIsLoading={groupIsLoading}
          posts={filteredPosts ?? null}
          selectedPostId={selectedPostId}
          goBack={handleGoBack}
          hideHeaderContents={setupLocked}
          goToPost={navigateToPost}
          goToMediaViewer={navigateToImage}
          goToChatDetails={handleChatDetailsPressed}
          goToSearch={navigateToSearch}
          goToContextLensRuns={navigateToContextLensRuns}
          goToContextLensRun={navigateToContextLensRun}
          goToDm={handleGoToDm}
          goToUserProfile={handleGoToUserProfile}
          goToGroupSettings={handleGoToGroupSettings}
          onScrollEndReached={loadOlder}
          onScrollStartReached={loadNewer}
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
