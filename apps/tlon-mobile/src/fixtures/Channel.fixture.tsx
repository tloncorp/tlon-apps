import {
  CalmProvider,
  Channel,
  ChannelSwitcherSheet,
  ContactsProvider,
} from '@tloncorp/ui';
import { useState } from 'react';

import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalChannel,
} from './fakeData';

const posts = createFakePosts(100);

const ChannelFixture = () => {
  const [open, setOpen] = useState(false);

  return (
    <CalmProvider
      initialCalm={{
        disableAppTileUnreads: false,
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
        disableSpellcheck: false,
      }}
    >
      <ContactsProvider initialContacts={initialContacts}>
        <Channel
          posts={posts}
          channel={tlonLocalChannel}
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
        />
      </ContactsProvider>
    </CalmProvider>
  );
};

export default ChannelFixture;
