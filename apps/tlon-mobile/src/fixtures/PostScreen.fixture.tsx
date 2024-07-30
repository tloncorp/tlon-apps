import { useGroup } from '@tloncorp/shared/dist';
import { PostScreenView } from '@tloncorp/ui';

import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
} from './fakeData';

const posts = createFakePosts(10);

const baseProps: Parameters<typeof PostScreenView>[0] = {
  editPost: async () => {},
  onPressRetry: () => {},
  onPressDelete: () => {},
  editingPost: undefined,
  negotiationMatch: true,
  setEditingPost: () => {},
  parentPost: null,
  currentUserId: '~solfer-magfed',
  contacts: initialContacts,
  calmSettings: {
    disableAvatars: false,
    disableNicknames: false,
    disableRemoteContent: false,
  },
  uploadAsset: async () => {},
  channel: tlonLocalBulletinBoard,
  posts: posts,
  sendReply: async () => {},
  markRead: () => {},
  groupMembers: group.members ?? [],
  getDraft: async () => ({}),
  storeDraft: () => {},
  clearDraft: () => {},
  canUpload: true,
  useGroup: useGroup,
  group: null,
  pinned: [],
  onPressGroupMeta: () => {},
  onPressGroupMembers: () => {},
  onPressManageChannels: () => {},
  onPressInvitesAndPrivacy: () => {},
  onPressRoles: () => {},
  onPressLeave: async () => {},
  onTogglePinned: () => {},
};

export default (
  <>
    <PostScreenView {...baseProps} />
  </>
);
