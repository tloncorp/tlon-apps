import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sendPost } from '@tloncorp/shared/dist/api';
import type { Upload } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import type { Story } from '@tloncorp/shared/dist/urbit';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { handleImagePicked } from '../hooks/storage/storage';
import { useUploader } from '../hooks/storage/upload';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import type { HomeStackParamList } from '../types';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  useFocusEffect(
    useCallback(() => {
      store.clearSyncQueue();
    }, [])
  );

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
  const selectedPost = props.route.params.selectedPost;
  const hasSelectedPost = !!selectedPost;

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
    ...(hasSelectedPost
      ? {
          direction: 'around',
          cursor: selectedPost.id,
        }
      : {
          direction: 'older',
          date: new Date(),
        }),
    count: 50,
  });
  const posts = useMemo<db.PostWithRelations[]>(
    () => postsData?.pages.flatMap((p) => p) ?? [],
    [postsData]
  );

  const { data: contacts } = store.useContacts();

  const { bottom } = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();

  const resetImageAttachment = useCallback(() => {
    setImageAttachment(null);
    setUploadedImage(null);
    uploader?.clear();
  }, [uploader]);

  const messageSender = useCallback(
    async (content: Story, channelId: string) => {
      if (!currentUserId || !channel) {
        return;
      }

      await sendPost(channelId, content, currentUserId);
      resetImageAttachment();
    },
    [currentUserId, channel, resetImageAttachment]
  );

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  useEffect(() => {
    if (
      uploader &&
      imageAttachment &&
      mostRecentFile?.status !== 'loading' &&
      mostRecentFile?.status !== 'error' &&
      mostRecentFile?.status !== 'success'
    ) {
      handleImagePicked(imageAttachment, uploader);
      setImageAttachment(null);
    }
  }, [imageAttachment, mostRecentFile, uploader]);

  useEffect(() => {
    if (
      mostRecentFile &&
      (mostRecentFile.status === 'success' ||
        mostRecentFile.status === 'loading')
    ) {
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

  const handleGoToImage = useCallback(
    (post: db.PostInsert, uri?: string) => {
      // @ts-expect-error TODO: fix typing for nested stack navigation
      props.navigation.navigate('ImageViewer', { post, uri });
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
        currentUserId={currentUserId}
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
        posts={posts}
        selectedPost={
          hasSelectedPost && posts?.length ? selectedPost?.id : undefined
        }
        goBack={props.navigation.goBack}
        messageSender={messageSender}
        goToPost={handleGoToPost}
        goToImageViewer={handleGoToImage}
        goToChannels={() => setChannelNavOpen(true)}
        goToSearch={() => props.navigation.push('ChannelSearch', { channel })}
        uploadedImage={uploadedImage}
        setImageAttachment={setImageAttachment}
        resetImageAttachment={resetImageAttachment}
        onScrollEndReached={handleScrollEndReached}
        onScrollStartReached={handleScrollStartReached}
        paddingBottom={bottom}
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
