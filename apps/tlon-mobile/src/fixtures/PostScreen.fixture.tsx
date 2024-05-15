import { PostScreenView } from '@tloncorp/ui';

import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
} from './fakeData';

const posts = createFakePosts(10);

export default (
  <>
    <PostScreenView
      editPost={() => {}}
      editingPost={undefined}
      setEditingPost={() => {}}
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
      groupMembers={group.members ?? []}
      getDraft={async () => ({})}
      storeDraft={() => {}}
      clearDraft={() => {}}
    />
  </>
);
