import { ScrollView, YStack } from 'tamagui';

import { ChannelListItem } from '../ui/components/ListItem/ChannelListItem';
import { FixtureWrapper } from './FixtureWrapper';
import { createFakePost, tlonLocalBulletinBoard, tlonLocalGettingStarted } from './fakeData';

const chatChannel = {
  ...tlonLocalGettingStarted,
  lastPost: createFakePost('chat'),
};

const notebookChannel = {
  ...tlonLocalBulletinBoard,
  type: 'notebook' as const,
  lastPost: createFakePost('note'),
};

const dmChannel = {
  id: 'dm-123',
  type: 'dm' as const,
  title: '',
  description: '',
  addedToGroupAt: Date.now(),
  currentUserIsMember: true,
  postCount: 10,
  unreadCount: 3,
  firstUnreadPostId: null,
  lastPostId: null,
  lastPostAt: Date.now(),
  remoteUpdatedAt: Date.now(),
  syncedAt: Date.now(),
  createdAt: Date.now(),
  isPendingChannel: false,
  isDmInvite: false,
  members: [
    {
      oderable: '',
      contactId: '~sampel-palnet',
      membershipType: 'channel' as const,
      chatId: 'dm-123',
      contact: {
        id: '~sampel-palnet',
        nickname: 'Sample User',
        avatarImage: null,
      },
    },
  ],
  lastPost: createFakePost('chat'),
  unread: { count: 3, notify: true },
};

const dmInviteChannel = {
  ...dmChannel,
  id: 'dm-invite-456',
  isDmInvite: true,
  unread: null,
};

function ChannelListItemFixture() {
  return (
    <ScrollView flex={1}>
      <YStack padding="$l" gap="$m">
        <ChannelListItem
          model={chatChannel as any}
          onPress={() => console.log('pressed chat')}
        />

        <ChannelListItem
          model={notebookChannel as any}
          onPress={() => console.log('pressed notebook')}
          useTypeIcon
        />

        <ChannelListItem
          model={dmChannel as any}
          onPress={() => console.log('pressed dm')}
        />

        <ChannelListItem
          model={dmInviteChannel as any}
          onPress={() => console.log('pressed dm invite')}
        />

        <ChannelListItem
          model={chatChannel as any}
          onPress={() => console.log('pressed dimmed')}
          dimmed
        />
      </YStack>
    </ScrollView>
  );
}

export default (
  <FixtureWrapper fillWidth fillHeight>
    <ChannelListItemFixture />
  </FixtureWrapper>
);
