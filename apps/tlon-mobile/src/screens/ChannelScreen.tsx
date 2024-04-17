import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JSONContent } from '@tiptap/core';
import { sendDirectMessage, sendPost } from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShip } from '../contexts/ship';
import type { HomeStackParamList } from '../types';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
  );
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

  const { top, bottom } = useSafeAreaInsets();
  const { ship } = useShip();

  const messageSender = async (content: JSONContent, channelId: string) => {
    if (!ship || !channel) {
      return;
    }

    const channelType = channel.type;

    if (channelType === 'dm' || channelType === 'groupDm') {
      await sendDirectMessage(channelId, content, ship);
      return;
    }

    await sendPost(channelId, content, ship);
  };
  const hasSelectedPost = !!props.route.params.selectedPost;

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

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

  if (!channel) {
    return null;
  }

  return (
    <View paddingTop={top} backgroundColor="$background" flex={1}>
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
        goToChannels={() => setChannelNavOpen(true)}
        goToSearch={() => props.navigation.push('ChannelSearch', { channel })}
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
