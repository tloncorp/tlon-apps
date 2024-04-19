import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JSONContent } from '@tiptap/core';
import { sendDirectMessage, sendPost } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import type * as ub from '@tloncorp/shared/dist/urbit';
import type { RNFile, Upload } from '@tloncorp/shared/dist/urbit';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShip } from '../contexts/ship';
import { useUploader } from '../hooks/storage/upload';
import type { HomeStackParamList } from '../types';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
  );
  const [imageAttachment, setImageAttachment] = React.useState<string | null>(
    null
  );
  const [uploadedImage, setUploadedImage] = React.useState<
    Upload | null | undefined
  >(null);
  const uploader = useUploader(`channel-${currentChannelId}`);
  const mostRecentFile = uploader?.getMostRecent();
  const { data: channel } = store.useChannelWithLastPostAndMembers({
    id: currentChannelId,
  });
  const { data: group, error } = store.useGroup({
    id: channel?.groupId ?? '',
  });
  const {
    data: postsData,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = store.useChannelPosts({
    channelId: currentChannelId,
    direction: 'older',
    date: new Date(),
    count: 50,
  });
  const posts = useMemo<db.PostWithRelations[]>(
    () => postsData?.pages.flatMap((p) => p) ?? [],
    [postsData]
  );
  const { data: aroundPosts } = store.useChannelPostsAround({
    channelId: currentChannelId,
    postId: props.route.params.selectedPost?.id ?? '',
  });
  const { data: contacts } = store.useContacts();

  const { bottom } = useSafeAreaInsets();
  const { ship } = useShip();

  const resetImageAttachment = useCallback(() => {
    setImageAttachment(null);
    setUploadedImage(null);
    uploader?.clear();
  }, [uploader]);

  const messageSender = useCallback(
    async (content: JSONContent, channelId: string, blocks: ub.Block[]) => {
      if (!ship || !channel) {
        return;
      }

      const channelType = channel.type;

      if (channelType === 'dm' || channelType === 'groupDm') {
        await sendDirectMessage(channelId, content, ship);
        return;
      }

      await sendPost(channelId, content, ship, blocks);
      resetImageAttachment();
    },
    [ship, channel, resetImageAttachment]
  );
  const hasSelectedPost = !!props.route.params.selectedPost;

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  const fetchImageFromUri = useCallback(
    async (uri: string) => {
      if (!imageAttachment) {
        return null;
      }
      const response = await fetch(uri);
      const blob = await response.blob();
      const name = uri.split('/').pop();

      const file: RNFile = {
        blob,
        name: name ?? 'channel-image',
        type: blob.type,
      };

      return file;
    },
    [imageAttachment]
  );

  const handleImagePicked = useCallback(
    async (uri: string) => {
      const image = await fetchImageFromUri(uri);
      if (!image) {
        return;
      }

      await uploader?.uploadFiles([image]);
    },
    [fetchImageFromUri, uploader]
  );

  useEffect(() => {
    if (
      imageAttachment &&
      mostRecentFile?.status !== 'loading' &&
      mostRecentFile?.status !== 'error' &&
      mostRecentFile?.status !== 'success'
    ) {
      handleImagePicked(imageAttachment);
      setImageAttachment(null);
    }
  }, [imageAttachment, handleImagePicked, mostRecentFile]);

  useEffect(() => {
    if (
      mostRecentFile &&
      (mostRecentFile.status === 'success' ||
        mostRecentFile.status === 'loading')
    ) {
      console.log({ mostRecentFile });
      setUploadedImage(mostRecentFile);

      if (mostRecentFile.status === 'success' && mostRecentFile.url !== '') {
        uploader?.clear();
      }
    }
  }, [mostRecentFile, uploader]);

  // TODO: Removed sync-on-enter behavior while figuring out data flow.

  const handleScrollEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleScrollStartReached = useCallback(() => {
    if (hasPreviousPage && !isFetchingPreviousPage) {
      fetchPreviousPage();
    }
  }, [fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage]);

  const handleGoToPost = useCallback(
    (post: db.PostInsert) => {
      props.navigation.push('Post', { post });
    },
    [props.navigation]
  );

  if (!channel) {
    return null;
  }

  return (
    <View backgroundColor="$background" flex={1}>
      <Channel
        channel={channel}
        currentUserId={ship!}
        calmSettings={{
          disableAppTileUnreads: false,
          disableAvatars: false,
          disableNicknames: false,
          disableRemoteContent: false,
          disableSpellcheck: false,
        }}
        isLoadingPosts={isFetchingNextPage || isFetchingPreviousPage}
        group={group ?? null}
        contacts={contacts ?? null}
        posts={hasSelectedPost ? aroundPosts ?? null : posts}
        selectedPost={
          hasSelectedPost && aroundPosts?.length
            ? props.route.params.selectedPost?.id
            : undefined
        }
        goBack={props.navigation.goBack}
        messageSender={messageSender}
        goToPost={handleGoToPost}
        goToChannels={() => setChannelNavOpen(true)}
        goToSearch={() => props.navigation.push('ChannelSearch', { channel })}
        imageAttachment={imageAttachment}
        uploadedImage={uploadedImage}
        setImageAttachment={setImageAttachment}
        resetImageAttachment={resetImageAttachment}
        onScrollEndReached={handleScrollEndReached}
        onScrollStartReached={handleScrollStartReached}
      />
      {group && (
        <ChannelSwitcherSheet
          open={channelNavOpen}
          onOpenChange={(open) => setChannelNavOpen(open)}
          group={group}
          channels={group?.channels || []}
          contacts={contacts ?? []}
          paddingBottom={bottom}
          onSelect={(channel: db.Channel) => {
            setCurrentChannelId(channel.id);
            setChannelNavOpen(false);
          }}
        />
      )}
    </View>
  );
}
