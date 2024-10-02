import { useFocusEffect } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  useCanUpload,
  useChannel,
  useGroupPreview,
  usePostReference,
  usePostWithRelations,
} from '@tloncorp/shared/dist/store';
import { Story } from '@tloncorp/shared/dist/urbit';
import {
  Channel,
  ChannelSwitcherSheet,
  ChatOptionsProvider,
  INITIAL_POSTS_PER_PAGE,
  InviteUsersSheet,
  useCurrentUserId,
} from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';

import { useChannelContext } from '../../hooks/useChannelContext';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import type { RootStackParamList } from '../../navigation/types';

const logger = createDevLogger('ChannelScreen', false);

type Props = NativeStackScreenProps<RootStackParamList, 'Channel'>;

export default function ChannelScreen(props: Props) {
  const channelFromParams = props.route.params.channel;
  const selectedPostId = props.route.params.selectedPostId;

  const currentUserId = useCurrentUserId();
  useFocusEffect(
    useCallback(() => {
      if (channelFromParams.group?.isNew) {
        store.markGroupVisited(channelFromParams.group);
      }

      if (!channelFromParams.isPendingChannel) {
        store.syncChannelThreadUnreads(channelFromParams.id, {
          priority: store.SyncPriority.High,
        });
      }
    }, [channelFromParams])
  );
  useFocusEffect(
    useCallback(
      () =>
        // Mark the channel as visited when we unfocus/leave this screen
        () => {
          store.markChannelVisited(channelFromParams);
        },
      [channelFromParams]
    )
  );

  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [inviteSheetGroup, setInviteSheetGroup] =
    React.useState<db.Group | null>();
  const [currentChannelId, setCurrentChannelId] = React.useState(
    channelFromParams.id
  );

  // for the unread channel divider, we care about the unread state when you enter but don't want it to update over
  // time
  const [initialChannelUnread, setInitialChannelUnread] =
    React.useState<db.ChannelUnread | null>(null);
  useEffect(() => {
    async function initializeChannelUnread() {
      const unread = await db.getChannelUnread({ channelId: currentChannelId });
      setInitialChannelUnread(unread ?? null);
    }
    initializeChannelUnread();
  }, [currentChannelId]);

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
    uploaderKey: `${currentChannelId}`,
  });

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
    ...(cursor
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
      await store.retrySendPost({
        channel,
        post,
      });
    },
    [channel]
  );

  const handleChannelNavButtonPressed = useCallback(() => {
    setChannelNavOpen(true);
  }, []);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setCurrentChannelId(channel.id);
    setChannelNavOpen(false);
  }, []);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      props.navigation.push('Channel', { channel: dmChannel });
    },
    [props.navigation]
  );

  const handleMarkRead = useCallback(() => {
    if (channel && !channel.isPendingChannel) {
      store.markChannelRead(channel);
    }
  }, [channel]);

  const canUpload = useCanUpload();

  const isFocused = useIsFocused();

  const { data: pins } = store.usePins({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return pins ?? [];
  }, [pins]);

  const chatOptionsNavProps = useChatSettingsNavigation();

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

  const handleInviteSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setInviteSheetGroup(null);
    }
  }, []);

  if (!channel) {
    return null;
  }

  return (
    <ChatOptionsProvider
      groupId={channelFromParams?.id}
      pinned={pinnedItems}
      useGroup={store.useGroup}
      onPressInvite={(group) => {
        setInviteSheetGroup(group);
      }}
      {...chatOptionsNavProps}
    >
      <Channel
        headerMode={headerMode}
        channel={channel}
        initialChannelUnread={initialChannelUnread}
        isLoadingPosts={isLoadingPosts}
        hasNewerPosts={postsQuery.hasPreviousPage}
        hasOlderPosts={postsQuery.hasNextPage}
        group={group}
        posts={posts}
        selectedPostId={selectedPostId}
        goBack={props.navigation.goBack}
        messageSender={sendPost}
        goToPost={navigateToPost}
        goToImageViewer={navigateToImage}
        goToChannels={handleChannelNavButtonPressed}
        goToSearch={navigateToSearch}
        goToDm={handleGoToDm}
        goToUserProfile={handleGoToUserProfile}
        uploadAsset={store.uploadAsset}
        onScrollEndReached={loadOlder}
        onScrollStartReached={loadNewer}
        onPressRef={navigateToRef}
        markRead={handleMarkRead}
        usePost={usePostWithRelations}
        usePostReference={usePostReference}
        useGroup={useGroupPreview}
        onGroupAction={performGroupAction}
        useChannel={useChannel}
        storeDraft={storeDraft}
        clearDraft={clearDraft}
        getDraft={getDraft}
        editingPost={editingPost}
        onPressDelete={handleDeletePost}
        onPressRetry={handleRetrySend}
        setEditingPost={setEditingPost}
        editPost={editPost}
        negotiationMatch={negotiationStatus.matchedOrPending}
        canUpload={canUpload}
      />
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
            group={inviteSheetGroup ?? undefined}
          />
        </>
      )}
    </ChatOptionsProvider>
  );
}
