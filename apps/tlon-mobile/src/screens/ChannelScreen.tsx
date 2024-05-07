import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Upload } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  handleImagePicked,
  useChannel,
  usePostWithRelations,
  useUploader,
} from '@tloncorp/shared/dist/store';
import type { Story } from '@tloncorp/shared/dist/urbit';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import type { HomeStackParamList } from '../types';
import { imageSize, resizeImage } from '../utils/images';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

// TODO: Pull from actual settings
const defaultCalmSettings = {
  disableAppTileUnreads: false,
  disableAvatars: false,
  disableNicknames: false,
  disableRemoteContent: false,
  disableSpellcheck: false,
};

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
  const [startedImageUpload, setStartedImageUpload] = React.useState(false);
  const [uploadedImage, setUploadedImage] = React.useState<
    Upload | null | undefined
  >(null);
  const [resizedImage, setResizedImage] = React.useState<string | null>(null);
  const uploader = useUploader(`channel-${currentChannelId}`, imageSize);
  const mostRecentFile = uploader?.getMostRecent();
  const channelQuery = store.useChannelWithLastPostAndMembers({
    id: currentChannelId,
  });
  const groupQuery = store.useGroup({
    id: channelQuery.data?.groupId ?? '',
  });
  const selectedPost = props.route.params.selectedPost;
  const hasSelectedPost = !!selectedPost;

  const postsQuery = store.useChannelPosts({
    channelId: currentChannelId,
    ...(hasSelectedPost
      ? {
          direction: 'around',
          cursor: selectedPost.id,
        }
      : {
          anchorToNewest: true,
        }),
    count: 50,
  });

  const posts = useMemo<db.Post[]>(
    () => postsQuery.data?.pages.flatMap((p) => p) ?? [],
    [postsQuery.data]
  );

  const contactsQuery = store.useContacts();

  const { bottom } = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();

  const resetImageAttachment = useCallback(() => {
    setResizedImage(null);
    setImageAttachment(null);
    setUploadedImage(null);
    setStartedImageUpload(false);
    uploader?.clear();
  }, [uploader]);

  const messageSender = useCallback(
    async (content: Story, channelId: string) => {
      if (!currentUserId || !channelQuery.data) {
        return;
      }
      store.sendPost({
        channel: channelQuery.data,
        authorId: currentUserId,
        content,
      });
      resetImageAttachment();
    },
    [currentUserId, channelQuery.data, resetImageAttachment]
  );

  useEffect(() => {
    if (groupQuery.error) {
      console.error(groupQuery.error);
    }
  }, [groupQuery.error]);

  useEffect(() => {
    const getResizedImage = async (uri: string) => {
      const manipulated = await resizeImage(uri);
      if (manipulated) {
        setResizedImage(manipulated);
      }
    };

    if (imageAttachment && !startedImageUpload) {
      if (!resizedImage) {
        getResizedImage(imageAttachment);
      }

      if (uploader && resizedImage) {
        handleImagePicked(resizedImage, uploader);
        setStartedImageUpload(true);
      }
    }
  }, [
    imageAttachment,
    mostRecentFile,
    uploader,
    startedImageUpload,
    resizedImage,
  ]);

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
    if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
      postsQuery.fetchNextPage();
    }
  }, [postsQuery]);

  const handleScrollStartReached = useCallback(() => {
    if (postsQuery.hasPreviousPage && !postsQuery.isFetchingPreviousPage) {
      postsQuery.fetchPreviousPage();
    }
  }, [postsQuery]);

  const handleGoToPost = useCallback(
    (post: db.Post) => {
      props.navigation.push('Post', { post });
    },
    [props.navigation]
  );

  const handleGoToRef = useCallback(
    (channel: db.Channel, post: db.Post) => {
      if (channel.id === currentChannelId) {
        props.navigation.navigate('Channel', { channel, selectedPost: post });
      } else {
        props.navigation.replace('Channel', { channel, selectedPost: post });
      }
    },
    [props.navigation, currentChannelId]
  );

  const handleGoToImage = useCallback(
    (post: db.Post, uri?: string) => {
      // @ts-expect-error TODO: fix typing for nested stack navigation
      props.navigation.navigate('ImageViewer', { post, uri });
    },
    [props.navigation]
  );

  const handleGoToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    props.navigation.push('ChannelSearch', {
      channel: channelQuery.data ?? null,
    });
  }, [props.navigation, channelQuery.data]);

  const handleChannelNavButtonPressed = useCallback(() => {
    setChannelNavOpen(true);
  }, []);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setCurrentChannelId(channel.id);
    setChannelNavOpen(false);
  }, []);

  if (!channelQuery.data) {
    return null;
  }

  return (
    <View backgroundColor="$background" flex={1}>
      <Channel
        channel={channelQuery.data}
        currentUserId={currentUserId}
        calmSettings={defaultCalmSettings}
        isLoadingPosts={
          postsQuery.isFetchingNextPage || postsQuery.isFetchingPreviousPage
        }
        group={groupQuery.data ?? null}
        contacts={contactsQuery.data ?? null}
        posts={posts}
        selectedPost={
          hasSelectedPost && posts?.length ? selectedPost?.id : undefined
        }
        goBack={props.navigation.goBack}
        messageSender={messageSender}
        goToPost={handleGoToPost}
        goToImageViewer={handleGoToImage}
        goToChannels={handleChannelNavButtonPressed}
        goToSearch={handleGoToSearch}
        uploadedImage={uploadedImage}
        imageAttachment={resizedImage}
        setImageAttachment={setImageAttachment}
        resetImageAttachment={resetImageAttachment}
        onScrollEndReached={handleScrollEndReached}
        onScrollStartReached={handleScrollStartReached}
        canUpload={!!uploader}
        onPressRef={handleGoToRef}
        usePost={usePostWithRelations}
        useChannel={useChannel}
      />
      {groupQuery.data && (
        <ChannelSwitcherSheet
          open={channelNavOpen}
          onOpenChange={(open) => setChannelNavOpen(open)}
          group={groupQuery.data}
          channels={groupQuery.data.channels || []}
          contacts={contactsQuery.data ?? []}
          paddingBottom={bottom}
          onSelect={handleChannelSelected}
        />
      )}
    </View>
  );
}
