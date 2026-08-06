import { useFocusEffect, useIsFocused } from '@react-navigation/native';
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

  const groupId = channel?.groupId ?? group?.id;

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
  const [initialChannelUnreadSnapshot, setInitialChannelUnreadSnapshot] =
    React.useState<{
      channelId: string;
      unread: db.ChannelUnread | null;
    } | null>(null);
  const isFocused = useIsFocused();
  useEffect(() => {
    let isCurrent = true;

    async function initializeChannelUnread() {
      const unread = await db.getChannelUnread({ channelId: currentChannelId });
      if (isCurrent) {
        setInitialChannelUnreadSnapshot({
          channelId: currentChannelId,
          unread: unread ?? null,
        });
      }
    }

    if (isFocused) {
      void initializeChannelUnread();
    }

    return () => {
      isCurrent = false;
    };
  }, [currentChannelId, isFocused]);

  const unreadDidInitialize =
    initialChannelUnreadSnapshot?.channelId === currentChannelId;
  const initialChannelUnread = unreadDidInitialize
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

  const { performGroupAction } = useGroupActions();

  const unreadCursor =
    channel &&
    initialChannelUnread &&
    (initialChannelUnread.countWithoutThreads ?? 0) > 0
      ? initialChannelUnread.firstUnreadPostId
      : undefined;
  const cursor = selectedPostId || unreadCursor;

  useEffect(() => {
    if (channel?.id) {
      logger.sensitiveCrumb(`channelId: ${channel?.id}`, `cursor: ${cursor}`);
    }
  }, [channel?.id, cursor]);

  // If scroll to bottom is pressed, it's most straighforward to ignore
  // existing cursor
  const [clearedCursor, setClearedCursor] = React.useState(false);

  // A selected post or channel navigation establishes a new cursor scope.
  useEffect(() => {
    setClearedCursor(false);
  }, [currentChannelId, selectedPostId]);

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
    // Capture the unread cursor before loading posts or mounting Channel,
    // which can mark the channel read as soon as cached posts are available.
    enabled:
      unreadDidInitialize && !!channel && !channel?.isPendingChannel,
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

  if (!channel || !unreadDidInitialize) {
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
          goBack={navigationRef.current.goBack}
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
