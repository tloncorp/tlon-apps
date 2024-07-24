import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
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

import type { RootStackParamList } from '../types';
import { useChannelContext } from './useChannelContext';

type ChannelScreenProps = NativeStackScreenProps<RootStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  useFocusEffect(
    useCallback(() => {
      if (props.route.params.channel.group?.isNew) {
        store.markGroupVisited(props.route.params.channel.group);
      }
      store.syncChannelThreadUnreads(
        props.route.params.channel.id,
        store.SyncPriority.High
      );
    }, [props.route.params.channel])
  );
  useFocusEffect(
    useCallback(
      () =>
        // Mark the channel as visited when we unfocus/leave this screen
        () => {
          store.markChannelVisited(props.route.params.channel);
        },
      [props.route.params.channel]
    )
  );

  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
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
    uploadInfo,
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

  const selectedPostId = props.route.params.selectedPostId;
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
  }, [!!channel, selectedPostId]);
  const {
    posts,
    query: postsQuery,
    loadNewer,
    loadOlder,
    isLoading: isLoadingPosts,
  } = store.useChannelPosts({
    enabled: !!channel,
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

      // clear the attachments immediately so consumers know the upload state is
      // no longer needed
      uploadInfo.resetImageAttachment();

      await store.sendPost({
        channel: channel,
        authorId: currentUserId,
        content,
        metadata,
      });
    },
    [currentUserId, channel, uploadInfo]
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
    if (channel) {
      store.markChannelRead(channel);
    }
  }, [channel]);

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
        goBack={props.navigation.goBack}
        messageSender={sendPost}
        goToPost={navigateToPost}
        goToImageViewer={navigateToImage}
        goToChannels={handleChannelNavButtonPressed}
        goToSearch={navigateToSearch}
        goToDm={handleGoToDm}
        uploadInfo={uploadInfo}
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
