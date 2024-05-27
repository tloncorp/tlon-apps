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
import React, { useCallback, useLayoutEffect, useMemo } from 'react';

import type { HomeStackParamList } from '../types';
import { useChannelContext } from './useChannelContext';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  useLayoutEffect(() => {
    if (props.navigation.isFocused()) {
      props.navigation.getParent()?.setOptions({
        tabBarStyle: {
          display: 'none',
        },
      });
    }

    return () => {
      props.navigation.getParent()?.setOptions({
        tabBarStyle: {
          display: undefined,
        },
      });
    };
  }, [props.navigation]);

  useFocusEffect(
    useCallback(() => {
      store.clearSyncQueue();
      if (props.route.params.channel.group?.isNew) {
        store.markGroupVisited(props.route.params.channel.group);
      }
    }, [props.route.params.channel.group])
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
    channelId: props.route.params.channel.id,
    draftKey: props.route.params.channel.id,
    uploaderKey: `${props.route.params.channel.id}`,
  });

  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
  );

  const selectedPostId = props.route.params.selectedPost?.id;
  const unread = channel?.unread;
  const firstUnreadId =
    unread &&
    (unread.countWithoutThreads ?? 0) > 0 &&
    unread?.firstUnreadPostId;
  const cursor = selectedPostId || firstUnreadId;
  const postsQuery = store.useChannelPosts({
    enabled: !!channel,
    channelId: currentChannelId,
    ...(cursor
      ? {
          mode: 'around',
          cursor,
          count: 10,
        }
      : {
          mode: 'newest',
          count: 10,
        }),
  });

  const posts = useMemo<db.Post[] | null>(
    () => postsQuery.data?.pages.flatMap((p) => p) ?? null,
    [postsQuery.data]
  );

  const sendPost = useCallback(
    async (content: Story, _channelId: string) => {
      if (!channel) {
        throw new Error('Tried to send message before channel loaded');
      }
      store.sendPost({
        channel: channel,
        authorId: currentUserId,
        content,
        attachment: uploadInfo.uploadedImage,
      });
      uploadInfo.resetImageAttachment();
    },
    [currentUserId, channel, uploadInfo]
  );

  const handleScrollEndReached = useCallback(() => {
    if (
      !postsQuery.isPaused &&
      postsQuery.hasNextPage &&
      !postsQuery.isFetchingNextPage
    ) {
      postsQuery.fetchNextPage();
    }
  }, [postsQuery]);

  const handleScrollStartReached = useCallback(() => {
    if (
      !postsQuery.isPaused &&
      postsQuery.hasPreviousPage &&
      !postsQuery.isFetchingPreviousPage
    ) {
      postsQuery.fetchPreviousPage();
    }
  }, [postsQuery]);

  const handleChannelNavButtonPressed = useCallback(() => {
    setChannelNavOpen(true);
  }, []);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setCurrentChannelId(channel.id);
    setChannelNavOpen(false);
  }, []);

  if (!channel) {
    return null;
  }

  return (
    <>
      <Channel
        channel={channel}
        currentUserId={currentUserId}
        calmSettings={calmSettings}
        isLoadingPosts={
          postsQuery.isPending ||
          postsQuery.isPaused ||
          postsQuery.isFetchingNextPage ||
          postsQuery.isFetchingPreviousPage
        }
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
        onScrollEndReached={handleScrollEndReached}
        onScrollStartReached={handleScrollStartReached}
        onPressRef={navigateToRef}
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
