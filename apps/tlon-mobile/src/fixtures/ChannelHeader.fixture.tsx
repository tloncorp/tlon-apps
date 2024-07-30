import { useGroup } from '@tloncorp/shared/dist';
import { ChannelHeader } from '@tloncorp/ui';

import { tlonLocalBulletinBoard } from './fakeData';

const channel = tlonLocalBulletinBoard;

const baseProps: Parameters<typeof ChannelHeader>[0] = {
  title: channel.title ?? '',
  channel: channel,
  showSearchButton: true,
  showSpinner: true,
  currentUserId: '~zod',
  useGroup: useGroup,
  onPressGroupMeta: () => {},
  onPressGroupMembers: () => {},
  onPressManageChannels: () => {},
  onPressInvitesAndPrivacy: () => {},
  onPressRoles: () => {},
  onPressLeave: () => Promise.resolve(),
  onTogglePinned: () => {},
  pinned: [],
} as const;

export default <ChannelHeader {...baseProps} />;
