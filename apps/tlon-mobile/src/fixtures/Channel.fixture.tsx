import { Channel, ChannelSwitcherSheet, View } from '@tloncorp/ui';
import { useState } from 'react';

import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalIntros,
} from './fakeData';

const posts = createFakePosts(100);

const ChannelFixture = () => {
  const [open, setOpen] = useState(false);

  const tlonLocalChannelWithUnreads = {
    ...tlonLocalIntros,
    unreadCount: 40,
    firstUnreadPostId: posts[10].id,
  };

  return (
    <View backgroundColor="$background" flex={1}>
      <Channel
        posts={posts}
        channel={tlonLocalChannelWithUnreads}
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
      />
      <ChannelSwitcherSheet
        open={open}
        onOpenChange={(open) => setOpen(open)}
        group={group}
        channels={group.channels || []}
        onSelect={() => {}}
        contacts={initialContacts}
      />
    </View>
  );
};

export default ChannelFixture;
