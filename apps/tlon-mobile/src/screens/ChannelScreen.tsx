import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '../types';

type ChannelScreenProps = NativeStackScreenProps<HomeStackParamList, 'Channel'>;

export default function ChannelScreen(props: ChannelScreenProps) {
  const [open, setOpen] = React.useState(false);
  const [currentChannel, setCurrentChannel] = React.useState<db.Channel | null>(
    props.route.params.channel ?? null
  );
  const { group } = props.route.params;
  const {
    result: groupWithChannels,
    isLoading,
    error,
  } = db.useGroup({ id: group.id });

  const { result: posts } = db.useChannelPosts({
    channelId: currentChannel?.id ?? '',
  });
  const { result: aroundPosts } = db.useChannelPostsAround({
    channelId: currentChannel?.id ?? '',
    postId: props.route.params.selectedPost?.id ?? '',
  });

  const { result: contacts } = db.useContacts();
  const { top } = useSafeAreaInsets();
  const hasSelectedPost = !!props.route.params.selectedPost;

  useEffect(() => {
    if (groupWithChannels) {
      setCurrentChannel(groupWithChannels.channels[0]);
    }
  }, [groupWithChannels]);

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  useEffect(() => {
    const syncChannel = async (id: string) => {
      if (props.route.params.selectedPost) {
        sync.syncPostsAround(props.route.params.selectedPost);
      } else {
        sync.syncChannel(id, Date.now());
      }
    };

    if (currentChannel) {
      syncChannel(currentChannel.id);
    }
  }, [currentChannel, props.route.params.selectedPost]);

  if (isLoading || !groupWithChannels || !currentChannel) {
    return null;
  }

  return (
    <View paddingTop={top} backgroundColor="$background" flex={1}>
      <Channel
        channel={currentChannel}
        calmSettings={{
          disableAppTileUnreads: false,
          disableAvatars: false,
          disableNicknames: false,
          disableRemoteContent: false,
          disableSpellcheck: false,
        }}
        group={groupWithChannels ?? []}
        contacts={contacts ?? []}
        posts={hasSelectedPost ? aroundPosts : posts}
        selectedPost={props.route.params.selectedPost?.id}
        goBack={props.navigation.goBack}
        goToChannels={() => setOpen(true)}
        goToSearch={() =>
          props.navigation.push('ChannelSearch', { channel: currentChannel })
        }
      />
      <ChannelSwitcherSheet
        open={open}
        onOpenChange={(open) => setOpen(open)}
        group={group}
        channels={groupWithChannels.channels || []}
        onSelect={(channel: db.Channel) => {
          setCurrentChannel(channel);
          setOpen(false);
        }}
      />
    </View>
  );
}
