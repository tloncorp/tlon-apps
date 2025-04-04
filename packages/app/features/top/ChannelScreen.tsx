import { useFocusEffect } from '@react-navigation/native';
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
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  Channel,
  ChannelSwitcherSheet,
  ChatOptionsProvider,
  INITIAL_POSTS_PER_PAGE,
  InviteUsersSheet,
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

  const [isChannelSwitcherEnabled] = useFeatureFlag('channelSwitcher');
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
    headerMode,
  } = useChannelContext({
    channelId: currentChannelId,
    draftKey: currentChannelId,
    isChannelSwitcherEnabled,
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
        db.updateGroup({
          id: groupId,
          lastVisitedChannelId: channelId,
        });
      }
    }, [groupId, channelId])
  );

  useEffect(() => {
    if (!channelIsPending) {
      store.syncChannelThreadUnreads(channelId, {
        priority: store.SyncPriority.High,
      });
    }
  }, [channelIsPending, channelId]);

  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [inviteSheetGroup, setInviteSheetGroup] = React.useState<
    string | null
  >();

  // for the unread channel divider, we care about the unread state when you enter but don't want it to update over
  // time
  const [initialChannelUnread, setInitialChannelUnread] =
    React.useState<db.ChannelUnread | null>(null);
  const [unreadDidInitialize, setUnreadDidInitialize] = React.useState(false);
  useEffect(() => {
    async function initializeChannelUnread() {
      const unread = await db.getChannelUnread({ channelId: currentChannelId });
      setInitialChannelUnread(unread ?? null);
      setUnreadDidInitialize(true);
    }
    initializeChannelUnread();
  }, [currentChannelId]);

  const { navigateToImage, navigateToPost, navigateToRef, navigateToSearch } =
    useChannelNavigation({ channelId: currentChannelId });

  const { performGroupAction } = useGroupActions();

  const session = store.useCurrentSession();
  const hasCachedNewest = useMemo(() => {
    if (!session || !channel) {
      return false;
    }
    const { syncedAt, lastPostAt } = channel;

    if (syncedAt == null) {
      return false;
    }

    // `syncedAt` is only set when sync endpoint reports that there are no newer posts.
    // https://github.com/tloncorp/tlon-apps/blob/adde000f4330af7e0a2e19bdfcb295f5eb9fe3da/packages/shared/src/store/sync.ts#L905-L910
    // We are guaranteed to have the most recent post before `syncedAt`; and
    // we are guaranteed to have the most recent post after `session.startTime`.

    // This case checks that we have overlap between sync backfill and session subscription.
    //
    //   ------------------------| syncedAt
    //     session.startTime |---------------
    if (syncedAt >= (session.startTime ?? 0)) {
      return true;
    }

    // `lastPostAt` is set with the channel's latest post during session init:
    // https://github.com/tloncorp/tlon-apps/blob/adde000f4330af7e0a2e19bdfcb295f5eb9fe3da/packages/shared/src/store/sync.ts#L1052
    //
    // Since we already checked that a session is active, this case checks
    // that we've hit `syncedAt`'s "no newer posts" at some point _after_ the
    // channel's most recent post's timestamp.
    //
    //          lastPostAt
    //              v
    //   ------------------------| syncedAt
    //
    // This check would fail if we first caught up via sync, and then later
    // started a session: in that case, there could be missing posts between
    // `syncedAt`'s "no newer posts" and the start of the session:
    //
    //                lastPostAt (post not received)
    //                    v
    //   ----| syncedAt
    //         session.startTime |---------
    //
    // NB: In that case, we *do* have the single latest post for the channel,
    // but we'd likely be missing all other posts in the gap. Wait until we
    // filled in the gap to show posts.
    if (lastPostAt && syncedAt > lastPostAt) {
      return true;
    }
    return false;
  }, [channel, session]);

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
      unreadDidInitialize &&
      (!posts || posts.length < ENOUGH_POSTS_TO_FILL_SCREEN)
    ) {
      loadOlder();
    }
  }, [postsQuery, posts, loadOlder, unreadDidInitialize]);

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

  const handleChannelNavButtonPressed = useCallback(() => {
    setChannelNavOpen(true);
  }, []);

  const handleChatDetailsPressed = useCallback(() => {
    if (group) {
      props.navigation.navigate('ChatDetails', {
        chatType: 'group',
        chatId: group.id,
      });
    }
  }, [group, props.navigation]);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setCurrentChannelId(channel.id);
    setChannelNavOpen(false);
  }, []);

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

  const handleInviteSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setInviteSheetGroup(null);
    }
  }, []);

  const channelRef = useRef<React.ElementRef<typeof Channel>>(null);

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
      onPressInvite={(group) => {
        setInviteSheetGroup(group);
      }}
      onPressConfigureChannel={channelRef.current?.openChannelConfigurationBar}
      {...chatOptionsNavProps}
    >
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <Channel
          key={currentChannelId}
          ref={channelRef}
          headerMode={headerMode}
          channel={channel}
          initialChannelUnread={
            clearedCursor ? undefined : initialChannelUnread
          }
          isLoadingPosts={isLoadingPosts}
          hasNewerPosts={postsQuery.hasPreviousPage}
          hasOlderPosts={postsQuery.hasNextPage}
          group={group}
          posts={filteredPosts ?? null}
          selectedPostId={selectedPostId}
          goBack={props.navigation.goBack}
          messageSender={sendPost}
          goToPost={navigateToPost}
          goToImageViewer={navigateToImage}
          goToChannels={handleChannelNavButtonPressed}
          goToChatDetails={handleChatDetailsPressed}
          goToSearch={navigateToSearch}
          goToDm={handleGoToDm}
          goToUserProfile={handleGoToUserProfile}
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
          onPressRetry={handleRetrySend}
          setEditingPost={setEditingPost}
          editPost={editPost}
          negotiationMatch={negotiationStatus.matchedOrPending}
          startDraft={startDraft}
          onPressScrollToBottom={handleScrollToBottom}
        />
      </AttachmentProvider>
      {group && (
        <>
          <ChannelSwitcherSheet
            open={channelNavOpen}
            onOpenChange={(open) => setChannelNavOpen(open)}
            group={group}
            channels={group?.channels || []}
            onSelect={handleChannelSelected}
          />
          <InviteUsersSheet
            open={inviteSheetGroup !== null}
            onOpenChange={handleInviteSheetOpenChange}
            onInviteComplete={() => setInviteSheetGroup(null)}
            groupId={inviteSheetGroup ?? undefined}
          />
        </>
      )}
    </ChatOptionsProvider>
  );
}
