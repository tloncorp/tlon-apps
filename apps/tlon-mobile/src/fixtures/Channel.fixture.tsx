import type * as db from '@tloncorp/shared/dist/db';
import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalIntros,
} from './fakeData';

const posts = createFakePosts(100);

const ChannelFixture = () => {
  const [open, setOpen] = useState(false);
  const [currentChannel, setCurrentChannel] =
    useState<db.ChannelWithLastPostAndMembers | null>(null);
  const { bottom } = useSafeAreaInsets();

  const tlonLocalChannelWithUnreads = {
    ...tlonLocalIntros,
    // unreadCount: 40,
    // firstUnreadPostId: posts[10].id,
  };

  useEffect(() => {
    if (group) {
      const firstChatChannel = group.channels.find((c) => c.type === 'chat');
      if (firstChatChannel) {
        setCurrentChannel(firstChatChannel);
      }
    }
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <View backgroundColor="$background">
        <Channel
          posts={posts}
          channel={currentChannel || tlonLocalChannelWithUnreads}
          contacts={initialContacts}
          group={group}
          calmSettings={{
            disableAppTileUnreads: false,
            disableAvatars: false,
            disableNicknames: false,
            disableRemoteContent: false,
            disableSpellcheck: false,
          }}
          goBack={() => {}}
          goToSearch={() => {}}
          goToChannels={() => setOpen(true)}
          messageSender={() => {}}
        />
        <ChannelSwitcherSheet
          open={open}
          onOpenChange={(open) => setOpen(open)}
          group={group}
          channels={group.channels || []}
          paddingBottom={bottom}
          onSelect={(channel: db.ChannelWithLastPostAndMembers) => {
            setCurrentChannel(channel);
            setOpen(false);
          }}
          contacts={initialContacts}
        />
      </View>
    </FixtureWrapper>
  );
};

export default ChannelFixture;
