import { PostScreenView } from '@tloncorp/ui';

import {
  createFakePosts,
  initialContacts,
  tlonLocalBulletinBoard,
} from './fakeData';

const posts = createFakePosts(10);

export default (
  <>
    <PostScreenView
      currentUserId="~solfer-magfed"
      contacts={initialContacts}
      calmSettings={{
        disableAppTileUnreads: false,
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
        disableSpellcheck: false,
      }}
      channel={tlonLocalBulletinBoard}
      posts={posts}
      sendReply={() => {}}
    />
  </>
);
