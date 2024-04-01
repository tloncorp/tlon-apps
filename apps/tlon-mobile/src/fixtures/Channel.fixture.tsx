import { CalmProvider, Channel, ContactsProvider } from '@tloncorp/ui';

import { createFakePosts, initialContacts, tlonLocalChannel } from './fakeData';

const posts = createFakePosts(20);

const ChannelFixture = () => (
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
        goToChannels={() => {}}
      />
    </ContactsProvider>
  </CalmProvider>
);

export default ChannelFixture;
