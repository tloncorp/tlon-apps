import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  configurationFromChannel,
  createDevLogger,
  useChannelContext,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  useCanUpload,
  useChannelPreview,
  useGroupPreview,
  usePostReference,
  usePostWithRelations,
} from '@tloncorp/shared/store';
import { Story } from '@tloncorp/shared/urbit';
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
import type { RootStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  Channel,
  ChatOptionsProvider,
  INITIAL_POSTS_PER_PAGE,
  useCurrentUserId,
} from '../../ui';

const logger = createDevLogger('ChannelScreen', false);

type Props = NativeStackScreenProps<RootStackParamList, 'Channel'>;

export default function ChannelScreen(props: Props) {
  const { channelId, selectedPostId, startDraft } = props.route.params ?? {
    channelId: '',
    selectedPostId: '',
    startDraft: false,
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
    editPost,
    channel,
    group,
  } = useChannelContext({
    channelId: currentChannelId,
    draftKey: currentChannelId,
  });

  const groupId = channel?.groupId ?? group?.id;
  const currentUserId = useCurrentUserId();

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

  const [lastChannelUnread, setLastChannelUnread] =
    useState<db.ChannelUnread | null>(null);
  const { data: channelUnread, isLoading: isLoadingChannelUnread } =
    store.useChannelUnread(currentChannelId);
  const channelUnreadInitialized =
    channelUnread !== undefined && !isLoadingChannelUnread;

  useEffect(() => {
    if (channelUnread && channelUnread.countWithoutThreads !== 0) {
      setLastChannelUnread(channelUnread);
    }
  }, [channelUnread]);
  console.log('channel unread', channelUnread, lastChannelUnread);

  const isFocused = useIsFocused();
  useEffect(() => {
    let timeout = null as NodeJS.Timeout | null;
    // if the channel receives new unreads, cancel the clearing of lastChannelUnread
    // so that we don't clear the marker for new unreads
    if (timeout && (channelUnread?.countWithoutThreads || 0) > 0) {
      clearTimeout(timeout);
      timeout = null;
    }

    // if the channel is in the background, we have a lastChannelUnread
    // and the countWithoutThreads is 0, we clear the lastChannelUnread after 10 seconds
    // to avoid showing stale unreads when the user comes back to the channel
    if (
      !isFocused &&
      lastChannelUnread &&
      channelUnread?.countWithoutThreads === 0
    ) {
      timeout = setTimeout(() => setLastChannelUnread(null), 10_000);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isFocused, lastChannelUnread, channelUnread?.countWithoutThreads]);

  const { navigateToImage, navigateToPost, navigateToRef, navigateToSearch } =
    useChannelNavigation({ channelId: currentChannelId });

  const { performGroupAction } = useGroupActions();

  const session = store.useCurrentSession();
  const hasCachedNewest = useMemo(() => {
    if (!channel) {
      return false;
    }
    return store.hasChannelCachedNewestPosts({
      session,
      channel,
    });
  }, [channel, session]);

  const cursor = useMemo(() => {
    if (!channel) {
      return undefined;
    }
    const firstUnreadId =
      lastChannelUnread &&
      (lastChannelUnread.countWithoutThreads ?? 0) > 0 &&
      lastChannelUnread?.firstUnreadPostId;
    return selectedPostId || firstUnreadId;
    // We only want this to rerun when the channel is loaded for the first time OR if
    // the selected post route param changes
    // eslint-disable-next-line
  }, [!!channel, lastChannelUnread, selectedPostId]);

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
    count: 15,
    hasCachedNewest,
    filterDeleted: !channelConfiguration?.includeDeletedPosts,
    ...(cursor && !clearedCursor
      ? {
          mode: 'around',
          cursor,
          firstPageCount: INITIAL_POSTS_PER_PAGE,
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
      channelUnreadInitialized &&
      (!posts || posts.length < ENOUGH_POSTS_TO_FILL_SCREEN)
    ) {
      loadOlder();
    }
  }, [postsQuery, posts, loadOlder, channelUnreadInitialized]);

  const filteredPosts = useMemo(
    () =>
      channel?.type !== 'chat' ? posts?.filter((p) => !p.isDeleted) : posts,
    [posts, channel]
  );

  const sendPost = useCallback(
    async (content: Story, _channelId: string, metadata?: db.PostMetadata) => {
      if (!channel) {
        throw new Error('Tried to send message before channel loaded');
      }

      await store.sendPost({
        channel: channel,
        authorId: currentUserId,
        content,
        metadata,
      });
    },
    [currentUserId, channel]
  );

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
        let metadata: db.PostMetadata = {
          title: '',
          image: '',
          description: '',
          cover: '',
        };
        if (post.lastEditTitle) {
          metadata = {
            ...metadata,
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
    if (group) {
      props.navigation.navigate('ChatDetails', {
        chatType: 'group',
        chatId: group.id,
      });
    }
  }, [group, props.navigation]);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      props.navigation.push('DM', { channelId: dmChannel.id });
    },
    [props.navigation]
  );

  const handleMarkRead = useCallback(async () => {
    if (channel && !channel.isPendingChannel) {
      store.markChannelRead({
        id: channel.id,
        groupId: channel.groupId ?? undefined,
      });
    }
  }, [channel?.type, channel?.id, channel?.groupId]);

  const canUpload = useCanUpload();

  const chatOptionsNavProps = useChatSettingsNavigation();

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.navigate('UserProfile', { userId });
    },
    [props.navigation]
  );

  const handleGoToGroupSettings = useCallback(() => {
    if (group) {
      props.navigation.navigate('GroupSettings', {
        screen: 'GroupMembers',
        params: { groupId: group.id },
      });
    }
  }, [group, props.navigation]);

  const channelRef = useRef<React.ElementRef<typeof Channel>>(null);
  const handleConfigureChannel = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.openChannelConfigurationBar();
    }
  }, [channelRef]);

  if (!channel) {
    return null;
  }

  return (
    <ChatOptionsProvider
      initialChat={{
        type: 'channel',
        id: currentChannelId,
      }}
      useGroup={store.useGroup}
      onPressConfigureChannel={handleConfigureChannel}
      {...chatOptionsNavProps}
    >
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <Channel
          key={currentChannelId}
          ref={channelRef}
          channel={channel}
          channelUnread={clearedCursor ? undefined : lastChannelUnread}
          isLoadingPosts={isLoadingPosts}
          loadPostsError={postsQuery.error}
          hasNewerPosts={postsQuery.hasPreviousPage}
          hasOlderPosts={postsQuery.hasNextPage}
          group={group}
          posts={filteredPosts ?? null}
          selectedPostId={selectedPostId}
          goBack={props.navigation.goBack}
          messageSender={sendPost}
          goToPost={navigateToPost}
          goToImageViewer={navigateToImage}
          goToChatDetails={handleChatDetailsPressed}
          goToSearch={navigateToSearch}
          goToDm={handleGoToDm}
          goToUserProfile={handleGoToUserProfile}
          goToGroupSettings={handleGoToGroupSettings}
          onScrollEndReached={loadOlder}
          onScrollStartReached={loadNewer}
          onPressRef={navigateToRef}
          markRead={handleMarkRead}
          usePost={usePostWithRelations}
          usePostReference={usePostReference}
          useGroup={useGroupPreview}
          onGroupAction={performGroupAction}
          useChannel={useChannelPreview}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          onPressDelete={handleDeletePost}
          onPressRetrySend={handleRetrySend}
          onPressRetryLoad={postsQuery.refetch}
          setEditingPost={setEditingPost}
          editPost={editPost}
          negotiationMatch={negotiationStatus.matchedOrPending}
          startDraft={startDraft}
          onPressScrollToBottom={handleScrollToBottom}
        />
      </AttachmentProvider>
    </ChatOptionsProvider>
  );
}
