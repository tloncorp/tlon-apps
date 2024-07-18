import { PostScreenView } from '@tloncorp/ui/src';

import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePost,
  createFakePosts,
  tlonLocalBulletinBoard,
  tlonLocalGettingStarted,
} from './fakeData';

const notebookPost = createFakePost('note');
const notebookReplies = createFakePosts(notebookPost.replyCount ?? 5, 'reply');
const galleryPost = createFakePost(
  'block',
  undefined,
  'https://togten.com:9001/finned-palmer/finned-palmer/2024.3.19..21.2.17..5581.0624.dd2f.1a9f-image.png'
);
const galleryReplies = createFakePosts(galleryPost.replyCount ?? 5, 'reply');

const NotebookDetailViewFixture = () => {
  return (
    <FixtureWrapper>
      <PostScreenView
        parentPost={notebookPost}
        posts={notebookReplies}
        contacts={[]}
        channel={tlonLocalGettingStarted}
        currentUserId={notebookPost.authorId}
        sendReply={async () => {}}
        groupMembers={[]}
        negotiationMatch={true}
        editPost={async () => {}}
        uploadAsset={async () => {}}
        storeDraft={() => {}}
        clearDraft={() => {}}
        getDraft={async () => ({})}
        goBack={() => {}}
        markRead={() => {}}
        canUpload={true}
      />
    </FixtureWrapper>
  );
};

const GalleryDetailViewFixture = () => {
  return (
    <FixtureWrapper>
      <PostScreenView
        parentPost={galleryPost}
        posts={galleryReplies}
        contacts={[]}
        channel={tlonLocalBulletinBoard}
        currentUserId={galleryPost.authorId}
        sendReply={async () => {}}
        groupMembers={[]}
        negotiationMatch={true}
        editPost={async () => {}}
        uploadAsset={async () => {}}
        storeDraft={() => {}}
        clearDraft={() => {}}
        getDraft={async () => ({})}
        goBack={() => {}}
        markRead={() => {}}
        canUpload={true}
      />
    </FixtureWrapper>
  );
};

export default {
  notebook: NotebookDetailViewFixture,
  galleryPost: GalleryDetailViewFixture,
};
