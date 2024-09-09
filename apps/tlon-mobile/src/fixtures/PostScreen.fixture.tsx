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
      handleGoToUserProfile={() => {}}
      editPost={async () => {}}
      onPressRetry={() => {}}
      onPressDelete={() => {}}
      editingPost={undefined}
      negotiationMatch={true}
      setEditingPost={() => {}}
      parentPost={null}
      currentUserId="~solfer-magfed"
      contacts={initialContacts}
      calmSettings={{
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
      }}
      uploadAsset={async () => {}}
      channel={tlonLocalBulletinBoard}
      posts={posts}
      sendReply={async () => {}}
      markRead={() => {}}
      groupMembers={group.members ?? []}
      getDraft={async () => ({})}
      storeDraft={() => {}}
      clearDraft={() => {}}
      canUpload={true}
    />
  </>
);
