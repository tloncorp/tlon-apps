import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sync } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useChannel, usePostWithRelations } from '@tloncorp/shared/dist/store';
import type { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useImageUpload } from '../hooks/useImageUpload';
import storage from '../lib/storage';
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
  const calmSettingsQuery = store.useCalmSettings({
    userId: useCurrentUserId(),
  });
  const channelQuery = store.useChannelWithLastPostAndMembers({
    id: currentChannelId,
  });
  const groupQuery = store.useGroup({
    id: channelQuery.data?.groupId ?? '',
  });
  const selectedPost = props.route.params.selectedPost;
  const hasSelectedPost = !!selectedPost;

  const uploadInfo = useImageUpload({
    uploaderKey: `${props.route.params.channel.id}`,
  });

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
      uploadInfo.resetImageAttachment();
    },
    [currentUserId, channelQuery.data, uploadInfo]
  );

  useEffect(() => {
    sync.syncGroup(channelQuery.data?.groupId ?? '');
  }, [channelQuery.data?.groupId]);

  useEffect(() => {
    if (groupQuery.error) {
      console.error(groupQuery.error);
    }
  }, [groupQuery.error]);

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

  const getDraft = useCallback(async () => {
    try {
      const draft = await storage.load({ key: `draft-${currentChannelId}` });

      return draft;
    } catch (e) {
      console.log('Error loading draft', e);
      return null;
    }
  }, [currentChannelId]);

  const storeDraft = useCallback(
    async (draft: JSONContent) => {
      try {
        await storage.save({ key: `draft-${currentChannelId}`, data: draft });
      } catch (e) {
        console.log('Error saving draft', e);
      }
    },
    [currentChannelId]
  );

  const clearDraft = useCallback(async () => {
    try {
      await storage.remove({ key: `draft-${currentChannelId}` });
    } catch (e) {
      console.log('Error clearing draft', e);
    }
  }, [currentChannelId]);

  if (!channelQuery.data) {
    return null;
  }

  return (
    <View backgroundColor="$background" flex={1}>
      <Channel
        channel={channelQuery.data}
        currentUserId={currentUserId}
        calmSettings={calmSettingsQuery.data}
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
        uploadInfo={uploadInfo}
        onScrollEndReached={handleScrollEndReached}
        onScrollStartReached={handleScrollStartReached}
        onPressRef={handleGoToRef}
        usePost={usePostWithRelations}
        useChannel={useChannel}
        storeDraft={storeDraft}
        clearDraft={clearDraft}
        getDraft={getDraft}
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
