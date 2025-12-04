import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { YStack } from 'tamagui';

import { DmInviteOptions } from '../ui/components/Channel/DmInviteOptions';
import { FixtureWrapper } from './FixtureWrapper';

const mockDmChannel: db.Channel = {
  id: '~sampel-palnet',
  type: 'dm',
  groupId: null,
  title: null,
  description: null,
  coverImage: null,
  coverImageColor: null,
  iconImage: null,
  iconImageColor: null,
  addedToGroupAt: null,
  currentUserIsMember: true,
  postCount: null,
  unreadCount: null,
  firstUnreadPostId: null,
  lastPostId: null,
  lastPostAt: null,
  syncedAt: null,
  remoteUpdatedAt: null,
  lastViewedAt: null,
  isDmInvite: true,
  pin: null,
  isPendingChannel: null,
  contactId: '~sampel-palnet',
};

const mockGroupDmChannel: db.Channel = {
  ...mockDmChannel,
  id: '0v123.456',
  type: 'groupDm',
  contactId: null,
};

function DmInviteOptionsFixture({ channel }: { channel: db.Channel }) {
  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack flex={1} padding="$2xl" gap="$2xl">
        <Text size="$label/l" color="$secondaryText">
          {channel.type === 'dm' ? 'Direct Message Invite' : 'Group DM Invite'}
        </Text>
        <Text size="$body" color="$tertiaryText">
          Someone wants to start a conversation with you.
        </Text>
        <DmInviteOptions
          channel={channel}
          goBack={() => console.log('Go back')}
        />
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'DM Invite': <DmInviteOptionsFixture channel={mockDmChannel} />,
  'Group DM Invite': <DmInviteOptionsFixture channel={mockGroupDmChannel} />,
};
