import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  useChannel,
  useGroupPreview,
  usePostWithRelations,
} from '@tloncorp/shared/dist/store';
import { Story } from '@tloncorp/shared/dist/urbit';
import { Channel, ChannelSwitcherSheet } from '@tloncorp/ui';
import React, { useCallback } from 'react';

import type { HomeStackParamList } from '../types';
import { useChannelContext } from './useChannelContext';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  useFocusEffect(
    useCallback(() => {
      store.clearSyncQueue();
      if (props.route.params.channel.group?.isNew) {
        store.markGroupVisited(props.route.params.channel.group);
      }
    }, [props.route.params.channel.group])
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
  } = useChannelContext({
    channelId: currentChannelId,
    draftKey: currentChannelId,
    uploaderKey: `${currentChannelId}`,
  });

  const selectedPostId = props.route.params.selectedPost?.id;
  const unread = channel?.unread;
  const firstUnreadId =
    unread &&
    (unread.countWithoutThreads ?? 0) > 0 &&
    unread?.firstUnreadPostId;
  const cursor = selectedPostId || firstUnreadId;
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
    ...(cursor
      ? {
          mode: 'around',
          cursor,
          firstPageCount: 10,
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
      store.sendPost({
        channel: channel,
        authorId: currentUserId,
        content,
        metadata,
      });
      uploadInfo.resetImageAttachment();
    },
    [currentUserId, channel, uploadInfo]
  );

  const handleChannelNavButtonPressed = useCallback(() => {
    setChannelNavOpen(true);
  }, []);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setCurrentChannelId(channel.id);
    setChannelNavOpen(false);
  }, []);

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
        uploadInfo={uploadInfo}
        onScrollEndReached={loadOlder}
        onScrollStartReached={loadNewer}
        onPressRef={navigateToRef}
        markRead={handleMarkRead}
        usePost={usePostWithRelations}
        useGroup={useGroupPreview}
        onGroupAction={performGroupAction}
        useChannel={useChannel}
        storeDraft={storeDraft}
        clearDraft={clearDraft}
        getDraft={getDraft}
        editingPost={editingPost}
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
