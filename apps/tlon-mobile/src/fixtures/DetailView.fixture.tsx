import { useGroup } from '@tloncorp/shared/dist';
import type * as db from '@tloncorp/shared/dist/db';
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

const baseProps: Parameters<typeof PostScreenView>[0] = {
  currentUserId: '~zod',
  contacts: [],
  channel: {} as db.Channel,
  parentPost: null,
  posts: [],
  sendReply: async () => {},
  markRead: () => {},
  goBack: () => {},
  group: null,
  groupMembers: [],
  pinned: [],
  calmSettings: null,
  uploadAsset: async () => {},
  handleGoToImage: () => {},
  storeDraft: () => {},
  clearDraft: () => {},
  getDraft: async () => ({}),
  editPost: async () => {},
  onPressRetry: () => {},
  onPressDelete: () => {},
  negotiationMatch: true,
  canUpload: true,
  useGroup: useGroup,
  onPressGroupMeta: () => {},
  onPressGroupMembers: () => {},
  onPressManageChannels: () => {},
  onPressInvitesAndPrivacy: () => {},
  onPressRoles: () => {},
  onPressLeave: async () => {},
  onTogglePinned: () => {},
};

const NotebookDetailViewFixture = () => {
  return (
    <FixtureWrapper>
      <PostScreenView
        {...baseProps}
        parentPost={notebookPost}
        posts={notebookReplies}
        channel={tlonLocalGettingStarted}
        currentUserId={notebookPost.authorId}
      />
    </FixtureWrapper>
  );
};

const GalleryDetailViewFixture = () => {
  return (
    <FixtureWrapper>
      <PostScreenView
        {...baseProps}
        parentPost={galleryPost}
        posts={galleryReplies}
        channel={tlonLocalBulletinBoard}
        currentUserId={galleryPost.authorId}
      />
    </FixtureWrapper>
  );
};

export default {
  notebook: NotebookDetailViewFixture,
  galleryPost: GalleryDetailViewFixture,
};
