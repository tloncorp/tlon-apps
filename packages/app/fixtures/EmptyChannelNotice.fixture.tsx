import * as db from '@tloncorp/shared/db';
import { useSelect } from 'react-cosmos/client';

import { EmptyChannelNotice } from '../ui/components/Channel/EmptyChannelNotice';
import { GroupsProvider } from '../ui/contexts/groups';
import { FixtureWrapper } from './FixtureWrapper';
import {
  group,
  tlonLocalBulletinBoard,
  tlonLocalGettingStarted,
  tlonLocalIntros,
} from './fakeData';

const dmChannel: db.Channel = {
  id: 'dm/~ravmel-ropdyl',
  type: 'dm',
  groupId: null,
  title: '~ravmel-ropdyl',
  description: null,
  iconImage: null,
  iconImageColor: null,
  coverImage: null,
  coverImageColor: null,
  currentUserIsMember: true,
  addedToGroupAt: null,
  lastPostAt: null,
  lastPostId: null,
  postCount: null,
  unreadCount: null,
  firstUnreadPostId: null,
  syncedAt: null,
  remoteUpdatedAt: null,
};

const groupDmChannel: db.Channel = {
  ...dmChannel,
  id: 'groupDm/~ravmel-ropdyl/~solfer-magfed',
  type: 'groupDm',
  title: 'Group DM',
};

const singleChannelGroup: db.Group = {
  ...group,
  id: '~zod/single-channel-group',
  title: 'Single Channel Group',
  channels: [{ ...tlonLocalIntros, groupId: '~zod/single-channel-group' }],
};

const singleChannelIntros: db.Channel = {
  ...tlonLocalIntros,
  groupId: '~zod/single-channel-group',
};

const channelsByType: Record<string, db.Channel> = {
  chat: tlonLocalIntros,
  gallery: tlonLocalBulletinBoard,
  notebook: tlonLocalGettingStarted,
  dm: dmChannel,
  groupDm: groupDmChannel,
  'chat (single-channel group)': singleChannelIntros,
};

function EmptyChannelNoticeFixture() {
  const [channelType] = useSelect('Channel type', {
    defaultValue: 'chat',
    options: [
      'chat',
      'gallery',
      'notebook',
      'dm',
      'groupDm',
      'chat (single-channel group)',
    ],
  });

  const [state] = useSelect<'empty' | 'loading' | 'error'>('State', {
    defaultValue: 'empty',
    options: ['empty', 'loading', 'error'],
  });

  const [privacy] = useSelect('Group privacy', {
    defaultValue: 'public' as const,
    options: ['public', 'private', 'secret'] as const,
  });

  const [isAdmin] = useSelect('Is admin', {
    defaultValue: 'no',
    options: ['no', 'yes'],
  });

  const channel = channelsByType[channelType];
  const isSingleChannelType = channelType === 'chat (single-channel group)';

  const activeGroup: db.Group = isSingleChannelType
    ? { ...singleChannelGroup, privacy }
    : { ...group, privacy };

  const groups =
    channel.type === 'dm' || channel.type === 'groupDm' ? [] : [activeGroup];

  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <GroupsProvider groups={groups}>
        <EmptyChannelNotice
          channel={channel}
          userId="~zod"
          isLoading={state === 'loading'}
          loadPostsError={
            state === 'error' ? new Error('Network request failed') : null
          }
          onPressRetryLoad={() => console.log('Retry load')}
          isAdmin={isAdmin === 'yes'}
        />
      </GroupsProvider>
    </FixtureWrapper>
  );
}

export default {
  'Empty Channel Notice': <EmptyChannelNoticeFixture />,
};
