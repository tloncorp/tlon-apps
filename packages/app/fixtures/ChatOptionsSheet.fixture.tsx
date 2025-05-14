import * as db from '@tloncorp/shared/db';
import { useSelect, useValue } from 'react-cosmos/client';

import {
  ChannelOptionsSheetContent,
  GroupOptionsSheetContent,
} from '../ui/components/ChatOptionsSheet';
import { AppDataContextProvider } from '../ui/contexts/appDataContext';
import { ChatOptionsProvider } from '../ui/contexts/chatOptions';
import { FixtureWrapper } from './FixtureWrapper';

interface ChannelMock {
  channel: db.Channel;
}

interface GroupMock {
  group: db.Group;
  groupUnread: db.GroupUnread | null;
}

const createMockData = (params: {
  type: 'channel' | 'dm' | 'groupDm' | 'group';
  isHost?: boolean;
  unreadCount?: number;
  privacy?: 'public' | 'private' | 'secret';
  contactsCount?: number;
}): ChannelMock | GroupMock => {
  const {
    type,
    isHost = false,
    unreadCount = 0,
    privacy = 'public',
    contactsCount = 1,
  } = params;

  const timestamp = Date.now();

  if (type === 'group') {
    if (unreadCount > 0) {
      const group: db.Group = {
        id: 'group/~sampel-palnet/test-group',
        title: 'Test Group',
        privacy,
        currentUserIsMember: true,
        currentUserIsHost: isHost,
        hostUserId: '~sampel-palnet',
        members: [],
      } as db.Group;

      // @ts-expect-error - dynamic property for UI
      group.unread = {
        count: unreadCount,
      };

      const groupUnread: db.GroupUnread = {
        groupId: group.id,
        updatedAt: timestamp,
        count: unreadCount,
        notifyCount: 0,
        notify: false,
      } as db.GroupUnread;

      return { group, groupUnread };
    } else {
      const group: db.Group = {
        id: 'group/~sampel-palnet/test-group',
        title: 'Test Group',
        privacy,
        currentUserIsMember: true,
        currentUserIsHost: isHost,
        hostUserId: '~sampel-palnet',
        members: [],
      } as db.Group;

      // @ts-expect-error - dynamic property for UI display
      group.unread = {
        count: 0,
      };

      const groupUnread: db.GroupUnread = {
        groupId: group.id,
        updatedAt: timestamp,
        count: 0,
        notifyCount: 0,
        notify: false,
      } as db.GroupUnread;

      return { group, groupUnread };
    }
  }

  if (type === 'dm' || type === 'groupDm') {
    const members = Array.from({ length: contactsCount }, (_, i) => ({
      contactId: `~${i === 0 ? 'sampel-palnet' : i}`,
      membershipType: 'channel',
    }));

    const channel: db.Channel = {
      id: `${type}/~sampel-palnet/${type === 'dm' ? 'direct-chat' : 'group-chat'}`,
      type,
      title: type === 'dm' ? undefined : 'Club',
      groupId: undefined,
      currentUserIsMember: true,
      currentUserIsHost: false,
      contactId: type === 'dm' ? '~zod' : undefined,
      members: type === 'groupDm' ? members : undefined,
    } as db.Channel;

    if (unreadCount > 0) {
      // @ts-expect-error - dynamic property for UI display
      channel.unread = {
        count: unreadCount,
      };
    } else {
      // @ts-expect-error - dynamic property for UI display
      channel.unread = { count: 0 };
    }

    return { channel };
  }

  const channel: db.Channel = {
    id: 'chat/~sampel-palnet/test-channel',
    type: 'chat',
    title: 'Test Channel',
    groupId: 'group/~sampel-palnet/test-group',
    currentUserIsMember: true,
    currentUserIsHost: isHost,
  } as db.Channel;

  if (unreadCount > 0) {
    // @ts-expect-error - dynamic property for UI display
    channel.unread = {
      count: unreadCount,
    };
  } else {
    // @ts-expect-error - dynamic property for UI display
    channel.unread = { count: 0 };
  }

  return { channel };
};

const mockFunctions = {
  onPressGroupMeta: () => {},
  onPressGroupMembers: () => {},
  onPressManageChannels: () => {},
  onPressInvite: () => {},
  onPressGroupPrivacy: () => {},
  onPressChannelMembers: () => {},
  onPressChannelMeta: () => {},
  onPressChannelTemplate: () => {},
  onPressRoles: () => {},
  onPressChatDetails: () => {},
  leaveGroup: async () => {},
  leaveChannel: () => {},
  onLeaveGroup: () => {},
  togglePinned: () => {},
  markChannelRead: () => {},
  markGroupRead: () => {},
  updateVolume: () => {},
};

const ChannelOptions = () => {
  const [isHost] = useValue('Is Host', { defaultValue: false });
  const [unreadCount] = useValue('Unread Count', { defaultValue: 0 });

  const mock = createMockData({
    type: 'channel',
    isHost,
    unreadCount,
  }) as ChannelMock;

  return (
    <AppDataContextProvider>
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <ChannelOptionsSheetContent
            chatTitle={`Test Channel (${isHost ? "you're the host" : "you're a member"})`}
            channel={mock.channel}
            onPressNotifications={() => {}}
            onOpenChange={() => {}}
          />
        </ChatOptionsProvider>
      </FixtureWrapper>
    </AppDataContextProvider>
  );
};

const GroupOptions = () => {
  const [isHost] = useValue('Is Host', { defaultValue: false });
  const [unreadCount] = useValue('Unread Count', { defaultValue: 0 });
  const [privacy] = useSelect('Privacy', {
    options: ['public', 'private', 'secret'],
    defaultValue: 'public',
  });

  const mock = createMockData({
    type: 'group',
    isHost,
    unreadCount,
    privacy: privacy as 'public' | 'private' | 'secret',
  }) as GroupMock;

  return (
    <AppDataContextProvider>
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <GroupOptionsSheetContent
            chatTitle={`${privacy.charAt(0).toUpperCase() + privacy.slice(1)} Group (${isHost ? "you're the host" : "you're a member"})`}
            group={mock.group}
            groupUnread={mock.groupUnread}
            currentUserIsAdmin={isHost}
            onPressNotifications={() => {}}
            onPressSort={() => {}}
            onOpenChange={() => {}}
          />
        </ChatOptionsProvider>
      </FixtureWrapper>
    </AppDataContextProvider>
  );
};

const DMOptions = () => {
  const [dmType] = useSelect('DM Type', {
    options: ['dm', 'groupDm'],
    defaultValue: 'dm',
  });

  const [memberCount] = useValue('Member Count', {
    defaultValue: dmType === 'dm' ? 1 : 3,
  });

  const [unreadCount] = useValue('Unread Count', { defaultValue: 0 });

  const mock = createMockData({
    type: dmType as 'dm' | 'groupDm',
    contactsCount: memberCount,
    unreadCount,
  }) as ChannelMock;

  const title =
    dmType === 'dm' ? 'Direct Message' : `Group DM (${memberCount} members)`;

  return (
    <AppDataContextProvider>
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <ChannelOptionsSheetContent
            chatTitle={title}
            channel={mock.channel}
            onPressNotifications={() => {}}
            onOpenChange={() => {}}
          />
        </ChatOptionsProvider>
      </FixtureWrapper>
    </AppDataContextProvider>
  );
};

export default {
  'Channel Options': ChannelOptions,
  'Group Options': GroupOptions,
  'DM Options': DMOptions,
};
