import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '../types';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  const [open, setOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
  );
  const { result: channel } = db.useChannelWithLastPostAndMembers({
    id: currentChannelId,
  });
  const { result: group, error } = db.useGroup({
    id: channel?.groupId ?? '',
  });
  const { result: posts } = db.useChannelPosts({
    channelId: currentChannelId,
  });
  const { result: aroundPosts } = db.useChannelPostsAround({
    channelId: currentChannelId,
    postId: props.route.params.selectedPost?.id ?? '',
  });
  const { result: contacts } = db.useContacts();

  const { top, bottom } = useSafeAreaInsets();
  const hasSelectedPost = !!props.route.params.selectedPost;

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  // useEffect(() => {
  //   const syncChannel = async (id: string) => {
  //     if (props.route.params.selectedPost) {
  //       sync.syncPostsAround(props.route.params.selectedPost);
  //     } else {
  //       sync.syncChannel(id, Date.now());
  //     }
  //   };

  //   if (currentChannel) {
  //     syncChannel(currentChannel.id);
  //   }
  // }, [currentChannel, props.route.params.selectedPost]);

  if (!channel) {
    return null;
  }

  return (
    <View paddingTop={top} backgroundColor="$background" flex={1}>
      <Channel
        channel={channel}
        calmSettings={{
          disableAppTileUnreads: false,
          disableAvatars: false,
          disableNicknames: false,
          disableRemoteContent: false,
          disableSpellcheck: false,
        }}
        group={group ?? null}
        contacts={contacts ?? null}
        posts={hasSelectedPost ? aroundPosts : posts}
        selectedPost={
          hasSelectedPost && aroundPosts?.length
            ? props.route.params.selectedPost?.id
            : undefined
        }
        goBack={props.navigation.goBack}
        goToChannels={() => setOpen(true)}
        goToSearch={() => props.navigation.push('ChannelSearch', { channel })}
      />
      {group && (
        <ChannelSwitcherSheet
          open={open}
          onOpenChange={(open) => setOpen(open)}
          group={group}
          channels={group?.channels || []}
          contacts={contacts ?? []}
          paddingBottom={bottom}
          onSelect={(channel: db.Channel) => {
            setCurrentChannelId(channel.id);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}
