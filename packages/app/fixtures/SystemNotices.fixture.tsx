import * as db from '@tloncorp/shared/db';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { ShipProvider } from '../contexts/ship';
import { ChatList } from '../features/chat-list/ChatList';
import { ChatListTabs } from '../features/chat-list/ChatListTabs';
import {
  ContactsScreenView,
  GroupChannelsScreenView,
  InlineScreenHeaderProvider,
  ScreenHeader,
  View,
} from '../ui';
import { CreateChannelSheet } from '../ui/components/ManageChannels/CreateChannelSheet';
import SystemNotices from '../ui/components/SystemNotices';
import { ChannelFixture } from './Channel.fixture';
import { FixtureWrapper } from './FixtureWrapper';
import {
  group,
  initialContacts,
  tlonLocalBulletinBoard,
  tlonLocalIntros,
  tlonLocalWaterCooler,
} from './fakeData';

const noop = () => {};
const currentUserId = '~zod';

const groupWithRequests: db.Group = {
  ...group,
  joinRequests: [
    {
      groupId: group.id,
      contactId: '~sampel-palnet',
      requestedAt: Date.now(),
    },
  ],
  pendingMembersDismissedAt: 0,
};

const singleChannelGroupWithRequests: db.Group = {
  ...groupWithRequests,
  channels: [tlonLocalIntros],
  navSections: [],
};

const homeChats: db.Chat[] = [
  {
    id: group.id,
    type: 'group',
    group,
    pin: null,
    volumeSettings: null,
    timestamp: Date.now(),
    isPending: false,
    unreadCount: 4,
  },
  {
    id: tlonLocalWaterCooler.id,
    type: 'channel',
    channel: tlonLocalWaterCooler,
    pin: null,
    volumeSettings: null,
    timestamp: Date.now() - 1,
    isPending: false,
    unreadCount: 2,
  },
  {
    id: tlonLocalBulletinBoard.id,
    type: 'channel',
    channel: tlonLocalBulletinBoard,
    pin: null,
    volumeSettings: null,
    timestamp: Date.now() - 2,
    isPending: false,
    unreadCount: 0,
  },
];

function FullScreenFixture({ children }: { children: ReactNode }) {
  return (
    <FixtureWrapper
      fillHeight
      fillWidth
      verticalAlign="top"
      backgroundColor="$background"
    >
      <InlineScreenHeaderProvider value>
        <View flex={1} backgroundColor="$background">
          {children}
        </View>
      </InlineScreenHeaderProvider>
    </FixtureWrapper>
  );
}

function HomeNotificationsFixture() {
  return (
    <FullScreenFixture>
      <View flex={1}>
        <View flex={1}>
          <ScreenHeader
            title="Home"
            placement="navigation"
            rightActions={[
              { id: 'search', icon: 'Search', label: 'Search', onPress: noop },
              {
                id: 'add-chat',
                icon: 'Add',
                label: 'Add a chat',
                onPress: noop,
              },
            ]}
          />
          <ChatListTabs activeTab="home" onPressTab={noop} />
          <ChatList
            data={[{ title: 'All', data: homeChats }]}
            allPinnedChats={[]}
            onPressItem={noop}
          />
        </View>
        <SystemNotices.NotificationsPromptView
          primaryActionLabel="Settings"
          onDismiss={noop}
          onPrimaryAction={noop}
        />
      </View>
    </FullScreenFixture>
  );
}

function ContactsPromptFixture({
  status,
}: {
  status: 'denied' | 'undetermined';
}) {
  return (
    <FullScreenFixture>
      <ScreenHeader
        title="Contacts"
        placement="navigation"
        borderBottom
        leftActions={[
          {
            id: 'add-contacts',
            icon: 'Add',
            label: 'Add contacts',
            onPress: noop,
          },
        ]}
        rightActions={[
          {
            id: 'contacts-settings',
            icon: 'Settings',
            label: 'Settings',
            onPress: noop,
          },
        ]}
      />
      <SystemNotices.ContactBookPromptView
        status={status}
        onDismiss={noop}
        onPrimaryAction={noop}
      />
      <ContactsScreenView
        contacts={initialContacts}
        systemContacts={[]}
        suggestions={[]}
        onContactPress={noop}
        onAddContact={noop}
        onContactLongPress={noop}
        onInviteSystemContact={noop}
      />
    </FullScreenFixture>
  );
}

function ChannelRequestsFixture() {
  return (
    <InlineScreenHeaderProvider value>
      <ChannelFixture
        theme="light"
        negotiationMatch
        passedProps={() => ({
          channel: tlonLocalIntros,
          group: singleChannelGroupWithRequests,
        })}
      />
    </InlineScreenHeaderProvider>
  );
}

function GroupChannelsRequestsFixture() {
  return (
    <FullScreenFixture>
      <GroupChannelsScreenView
        group={groupWithRequests}
        onChannelPressed={noop}
        onJoinChannel={noop}
        onBackPressed={noop}
        onGoToGroupMembers={noop}
        onPressManageChannels={noop}
      />
    </FullScreenFixture>
  );
}

function NonHostCreateChannelFixture() {
  const adminGroup = useMemo<db.Group>(
    () => ({
      ...group,
      currentUserIsHost: false,
      members: [
        ...(group.members ?? []),
        {
          contactId: currentUserId,
          joinedAt: 0,
          chatId: group.id,
          membershipType: 'group',
        },
      ],
    }),
    []
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await db.insertGroups({ groups: [adminGroup] });
      await db.addGroupRole({ groupId: adminGroup.id, roleId: 'admin' });
      await db.addMembersToRole({
        groupId: adminGroup.id,
        roleId: 'admin',
        contactIds: [currentUserId],
      });
      setReady(true);
    })();
  }, [adminGroup]);

  if (!ready) {
    return null;
  }

  return (
    <ShipProvider
      initialShipInfo={{
        authType: 'hosted',
        ship: 'zod',
        shipUrl: 'https://zod.test',
        authCookie: 'fixture',
        needsSplashSequence: false,
      }}
    >
      <FixtureWrapper fillHeight fillWidth>
        <CreateChannelSheet
          group={adminGroup}
          onOpenChange={noop}
          sheetProps={{ snapPoints: [95], snapPointsMode: 'percent' }}
        />
      </FixtureWrapper>
    </ShipProvider>
  );
}

export default {
  '01A Notifications — Expanded': (
    <SystemNotices.PresentationProvider value="expanded">
      <HomeNotificationsFixture />
    </SystemNotices.PresentationProvider>
  ),
  '01B Notifications — Compact': (
    <SystemNotices.PresentationProvider value="compact">
      <HomeNotificationsFixture />
    </SystemNotices.PresentationProvider>
  ),
  '02A Contacts ask — Expanded': (
    <SystemNotices.PresentationProvider value="expanded">
      <ContactsPromptFixture status="undetermined" />
    </SystemNotices.PresentationProvider>
  ),
  '02B Contacts ask — Compact': (
    <SystemNotices.PresentationProvider value="compact">
      <ContactsPromptFixture status="undetermined" />
    </SystemNotices.PresentationProvider>
  ),
  '03A Contacts settings — Expanded': (
    <SystemNotices.PresentationProvider value="expanded">
      <ContactsPromptFixture status="denied" />
    </SystemNotices.PresentationProvider>
  ),
  '03B Contacts settings — Compact': (
    <SystemNotices.PresentationProvider value="compact">
      <ContactsPromptFixture status="denied" />
    </SystemNotices.PresentationProvider>
  ),
  '04A New join requests channel — Expanded': (
    <SystemNotices.PresentationProvider value="expanded">
      <ChannelRequestsFixture />
    </SystemNotices.PresentationProvider>
  ),
  '04B New join requests channel — Compact': (
    <SystemNotices.PresentationProvider value="compact">
      <ChannelRequestsFixture />
    </SystemNotices.PresentationProvider>
  ),
  '05A New join requests list — Expanded': (
    <SystemNotices.PresentationProvider value="expanded">
      <GroupChannelsRequestsFixture />
    </SystemNotices.PresentationProvider>
  ),
  '05B New join requests list — Compact': (
    <SystemNotices.PresentationProvider value="compact">
      <GroupChannelsRequestsFixture />
    </SystemNotices.PresentationProvider>
  ),
  '06A Non-host admin — Expanded': (
    <SystemNotices.PresentationProvider value="expanded">
      <NonHostCreateChannelFixture />
    </SystemNotices.PresentationProvider>
  ),
  '06B Non-host admin — Compact': (
    <SystemNotices.PresentationProvider value="compact">
      <NonHostCreateChannelFixture />
    </SystemNotices.PresentationProvider>
  ),
};
