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
  INITIAL_POSTS_PER_PAGE,
} from '@tloncorp/ui';
import React, { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';

import useFocusEffect from '@/hooks/useFocusEffect';

import { useChannelContext } from './useChannelContext';

export default function ChannelScreen() {
  const { ship, name, chShip, chType, chName, postId } = useParams();
  const navigate = useNavigate();
  const groupId = `${ship}/${name}`;
  const channelId = `${chType}/${chShip}/${chName}`;
  const selectedPostId = postId;
  // const { data: groupData } = store.useGroup({ id: groupId });
  // const { data: channel } = store.useChannel({ id: channelId });

  useFocusEffect(
    useCallback(() => {
      if (groupId && channelId) {
        // if (groupData?.isNew) {
        // store.markGroupVisited(groupData);
        // }
        store.syncChannelThreadUnreads(channelId, {
          priority: store.SyncPriority.High,
        });
      }
    }, [groupId, channelId])
  );
  useFocusEffect(
    useCallback(
      () =>
        // Mark the channel as visited when we unfocus/leave this screen
        () => {
          // if (channelId) {
          // if (channel) {
          // store.markChannelVisited(channel);
          // }
          // }
        },
      [channelId]
    )
  );

  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(channelId);

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
    channelId: currentChannelId!,
    draftKey: currentChannelId!,
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

  // const selectedPostId = postId;
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
    // We only want this to rerun when the channel is loaded for the first time.
    // eslint-disable-next-line
  }, [!!channel]);
  const {
    posts,
    query: postsQuery,
    loadNewer,
    loadOlder,
    isLoading: isLoadingPosts,
  } = store.useChannelPosts({
    enabled: !!channel,
    channelId: currentChannelId!,
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
      // props.navigation.push('Channel', { channel: dmChannel });
      navigate('/channel/' + dmChannel.id);
    },
    [navigate]
  );

  const handleMarkRead = useCallback(() => {
    if (channel) {
      store.markChannelRead(channel);
    }
  }, [channel]);

  const canUpload = useCanUpload();

  if (!channel) {
    return null;
  }

  return (
    <>
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
        goBack={() => navigate('..')}
        messageSender={sendPost}
        goToPost={navigateToPost}
        goToImageViewer={navigateToImage}
        goToChannels={handleChannelNavButtonPressed}
        goToSearch={navigateToSearch}
        goToDm={handleGoToDm}
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
    </>
  );
}
