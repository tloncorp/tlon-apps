import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sync } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useChannel, usePostWithRelations } from '@tloncorp/shared/dist/store';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useImageUpload } from '../hooks/useImageUpload';
import storage from '../lib/storage';
import type { HomeStackParamList } from '../types';

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
    }, [])
  );

  const [editingPost, setEditingPost] = React.useState<db.Post>();
  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
  );
  const calmSettingsQuery = store.useCalmSettings({
    userId: useCurrentUserId(),
  });

  const channelHost = useMemo(
    () => currentChannelId.split('/')[1],
    [currentChannelId]
  );

  const { matchedOrPending } = store.useNegotiate(
    channelHost,
    'channels',
    'channels-server'
  );

  const channelQuery = store.useChannelWithLastPostAndMembers({
    id: currentChannelId,
  });
  const groupQuery = store.useGroup({
    id: channelQuery.data?.groupId ?? '',
  });
  const uploadInfo = useImageUpload({
    uploaderKey: `${props.route.params.channel.id}`,
  });

  const selectedPostId = props.route.params.selectedPost?.id;
  const unread = channelQuery.data?.unread;
  const firstUnreadId =
    unread &&
    (unread.countWithoutThreads ?? 0) > 0 &&
    unread?.firstUnreadPostId;
  const cursor = selectedPostId || firstUnreadId;
  const postsQuery = store.useChannelPosts({
    enabled: !!channelQuery.data,
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

  const contactsQuery = store.useContacts();

  const { bottom } = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();

  const messageSender = useCallback(
    async (content: Story, _channelId: string) => {
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

  const editPost = useCallback(
    async (post: db.Post, content: Story) => {
      if (!channelQuery.data) {
        return;
      }

      store.editPost({
        post,
        content,
        channel: channelQuery.data,
      });
      setEditingPost(undefined);
    },
    [channelQuery.data]
  );

  useEffect(() => {
    if (channelQuery.data?.groupId) {
      sync.syncGroup(channelQuery.data?.groupId);
    }
  }, [channelQuery.data?.groupId]);

  useEffect(() => {
    if (groupQuery.error) {
      console.error(groupQuery.error);
    }
  }, [groupQuery.error]);

  // TODO: Removed sync-on-enter behavior while figuring out data flow.

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
      return null;
    }
  }, [currentChannelId]);

  const storeDraft = useCallback(
    async (draft: JSONContent) => {
      try {
        await storage.save({ key: `draft-${currentChannelId}`, data: draft });
      } catch (e) {
        return;
      }
    },
    [currentChannelId]
  );

  const clearDraft = useCallback(async () => {
    try {
      await storage.remove({ key: `draft-${currentChannelId}` });
    } catch (e) {
      return;
    }
  }, [currentChannelId]);

  if (!channelQuery.data) {
    return null;
  }

  return (
    <View paddingBottom={bottom} backgroundColor="$background" flex={1}>
      <Channel
        channel={channelQuery.data}
        currentUserId={currentUserId}
        calmSettings={calmSettingsQuery.data}
        isLoadingPosts={
          postsQuery.isPending ||
          postsQuery.isPaused ||
          postsQuery.isFetchingNextPage ||
          postsQuery.isFetchingPreviousPage
        }
        hasNewerPosts={postsQuery.hasPreviousPage}
        hasOlderPosts={postsQuery.hasNextPage}
        group={groupQuery.data ?? null}
        contacts={contactsQuery.data ?? null}
        posts={posts}
        selectedPostId={selectedPostId}
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
        editingPost={editingPost}
        setEditingPost={setEditingPost}
        editPost={editPost}
        negotiationMatch={matchedOrPending}
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
