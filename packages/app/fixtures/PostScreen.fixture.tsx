import { AppDataContextProvider, PostScreenView } from '../ui';
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
      onPressRetry={async () => {}}
      onPressDelete={() => {}}
      editingPost={undefined}
      negotiationMatch={true}
      setEditingPost={() => {}}
      parentPost={null}
      channel={tlonLocalBulletinBoard}
      posts={posts}
      sendReply={async () => {}}
      markRead={() => {}}
      groupMembers={group.members ?? []}
      getDraft={async () => ({})}
      storeDraft={async () => {}}
      clearDraft={async () => {}}
      headerMode="default"
      onPressRef={() => {}}
      onGroupAction={() => {}}
      goToDm={() => {}}
    />
  </AppDataContextProvider>
);
