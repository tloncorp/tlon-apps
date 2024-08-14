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
} from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';

import { useChannelContext } from '../../hooks/useChannelContext';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useFocusEffect } from '../../hooks/useFocusEffect';
import { useIsFocused } from '../../hooks/useIsFocused';

const logger = createDevLogger('ChannelScreen', false);

export default function ChannelScreen({
  channelFromParams,
  navigateToDm,
  navigateToUserProfile,
  goBack,
  selectedPostId,
}: {
  channelFromParams: db.Channel;
  navigateToDm: (channel: db.Channel) => void;
  goBack: () => void;
  navigateToUserProfile: (userId: string) => void;
  groupFromParams?: db.Group | null;
  selectedPostId?: string | null;
}) {
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
  const [currentChannelId, setCurrentChannelId] = React.useState(
    channelFromParams.id
  );

  const {
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    editingPost,
    setEditingPost,
    editPost,
    contacts,
    channel,
    group,
    navigateToImage,
    navigateToPost,
    navigateToRef,
    navigateToSearch,
    calmSettings,
    currentUserId,
    performGroupAction,
    headerMode,
  } = useChannelContext({
    channelId: currentChannelId,
    draftKey: currentChannelId,
    uploaderKey: `${currentChannelId}`,
  });

  const session = store.useCurrentSession();
  const hasCachedNewest = useMemo(() => {
    if (!session || !channel) {
      return false;
    }
    const { syncedAt, lastPostAt } = channel;
    if (syncedAt && session.startTime < syncedAt) {
      return true;
    } else if (lastPostAt && syncedAt && syncedAt > lastPostAt) {
      return true;
    }
    return false;
  }, [channel, session]);

  const cursor = useMemo(() => {
    if (!channel) {
      return undefined;
    }
    const unread = channel?.unread;
    const firstUnreadId =
      unread &&
      (unread.countWithoutThreads ?? 0) > 0 &&
      unread?.firstUnreadPostId;
    return selectedPostId || firstUnreadId;
    // We only want this to rerun when the channel is loaded for the first time OR if
    // the selected post route param changes
    // eslint-disable-next-line
  }, [!!channel, selectedPostId]);

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
    count: 50,
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
      navigateToDm(dmChannel);
    },
    [navigateToDm]
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
      navigateToUserProfile(userId);
    },
    [navigateToUserProfile]
  );

  if (!channel) {
    return null;
  }

  return (
    <ChatOptionsProvider
      groupId={channelFromParams?.id}
      pinned={pinnedItems}
      useGroup={store.useGroup}
      {...chatOptionsNavProps}
    >
      <Channel
        headerMode={headerMode}
        channel={channel}
        currentUserId={currentUserId}
        calmSettings={calmSettings}
        isLoadingPosts={isLoadingPosts}
        hasNewerPosts={postsQuery.hasPreviousPage}
        hasOlderPosts={postsQuery.hasNextPage}
        group={group}
        contacts={contacts}
        posts={posts}
        selectedPostId={selectedPostId}
        goBack={goBack}
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
        <ChannelSwitcherSheet
          open={channelNavOpen}
          onOpenChange={(open) => setChannelNavOpen(open)}
          group={group}
          channels={group?.channels || []}
          contacts={contacts ?? []}
          onSelect={handleChannelSelected}
        />
      )}
    </ChatOptionsProvider>
  );
}
