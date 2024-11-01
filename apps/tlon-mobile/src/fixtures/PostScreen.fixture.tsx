import { AppDataContextProvider, PostScreenView } from '@tloncorp/ui';

import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
} from './fakeData';

const posts = createFakePosts(10);

export default (
  <AppDataContextProvider
    contacts={initialContacts}
    calmSettings={{
      disableAvatars: false,
      disableNicknames: false,
      disableRemoteContent: false,
    }}
  >
    <PostScreenView
      handleGoToUserProfile={() => {}}
      isLoadingPosts={false}
      editPost={async () => {}}
      onPressRetry={() => {}}
      onPressDelete={() => {}}
      editingPost={undefined}
      negotiationMatch={true}
      setEditingPost={() => {}}
      parentPost={null}
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
      headerMode="default"
      onPressRef={() => {}}
      onGroupAction={() => {}}
      goToDm={() => {}}
    />
  </AppDataContextProvider>
);
