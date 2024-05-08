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
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
      }}
      uploadInfo={{
        imageAttachment: null,
        resetImageAttachment: () => {},
        setImageAttachment: () => {},
        canUpload: true,
      }}
      channel={tlonLocalBulletinBoard}
      posts={posts}
      sendReply={() => {}}
    />
  </>
);
