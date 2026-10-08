import * as db from '@tloncorp/shared/db';
import { useSelect, useValue } from 'react-cosmos/client';

import {
  ChannelOptionsSheetContent,
  GroupOptionsSheetContent,
} from '../ui/components/ChatOptionsSheet';
import { AppDataContextProvider } from '../ui/contexts/appDataContext';
import { ChatOptionsProvider } from '../ui/contexts/chatOptions';
import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts, jamesContact } from './fakeData';

/**
 * ChatOptionsSheet fixture
 *
 * This fixture demonstrates the various states of the ChatOptionsSheet component,
 * focusing on three main scenarios:
 * 1. Channel options (with host/member variations)
 * 2. Group options (with host/member variations and privacy settings)
 * 3. DM options (individual and group DMs)
 *
 * Each scenario also demonstrates different unread counts.
 */

// Standard mock functions to pass to ChatOptionsProvider
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

interface MockDataResult {
  channel?: db.Channel;
  group?: db.Group;
  groupUnread?: db.GroupUnread;
}

/**
 * Creates mock data for different chat scenarios
 */
const createMockData = (params: {
  type: 'channel' | 'dm' | 'groupDm' | 'group';
  isHost?: boolean;
  unreadCount?: number;
  privacy?: 'public' | 'private' | 'secret';
  contactsCount?: number;
}): MockDataResult => {
  const {
    type,
    isHost = false,
    unreadCount = 0,
    privacy = 'public',
    contactsCount = 1,
  } = params;

  const timestamp = Date.now();
  const hostId = '~sampel-palnet';

  if (type === 'group') {
    // Create basic group structure that conforms to db.Group
    const group = {
      id: `group/${hostId}/test-group`,
      title: 'Test Group',
      privacy,
      currentUserIsMember: true,
      currentUserIsHost: isHost,
      hostUserId: hostId,
      // Members need to be structured as db.ChatMembers
      members: Array.from({ length: 5 }, (_, i) => ({
        contactId: i === 0 ? hostId : i,
        membershipType: 'group',
      })) as db.ChatMember[],
      channels: [],
    } as unknown as db.Group;

    // @ts-expect-error - dynamic property for UI display
    group.unread = { count: unreadCount };

    const groupUnread = {
      groupId: group.id,
      updatedAt: timestamp,
      count: unreadCount,
      notifyCount: 0,
      notify: false,
    } as db.GroupUnread;

    return { group, groupUnread };
  }

  if (type === 'dm' || type === 'groupDm') {
    const members = Array.from({ length: contactsCount }, (_, i) => ({
      contactId: i === 0 ? hostId : i,
      membershipType: 'channel',
    })) as db.ChatMember[];

    const channel = {
      id: `${type}/${hostId}/${type === 'dm' ? 'direct-chat' : 'group-chat'}`,
      type,
      title: type === 'dm' ? undefined : 'Group Chat',
      groupId: undefined,
      currentUserIsMember: true,
      currentUserIsHost: type === 'groupDm' && isHost,
      contactId: type === 'dm' ? '~zod' : undefined,
      members: type === 'groupDm' ? members : undefined,
    } as db.Channel;

    // @ts-expect-error - dynamic property for UI display
    channel.unread = { count: unreadCount };

    return { channel };
  }

  // Channel in a group
  const channel = {
    id: `chat/${hostId}/test-channel`,
    type: 'chat',
    title: 'Test Channel',
    groupId: `group/${hostId}/test-group`,
    currentUserIsMember: true,
    currentUserIsHost: isHost,
  } as db.Channel;

  // @ts-expect-error - dynamic property for UI display
  channel.unread = { count: unreadCount };

  return { channel };
};

/**
 * Channel options fixture component
 * Shows how the channel options sheet appears in different states
 */
const ChannelOptions = () => {
  const [isHost] = useValue('Is Host', { defaultValue: false });
  const [unreadCount] = useValue('Unread Count', { defaultValue: 0 });

  const mock = createMockData({
    type: 'channel',
    isHost,
    unreadCount,
  });

  const hostStatus = isHost ? "you're the host" : "you're a member";

  // Make sure we have a valid channel
  if (!mock.channel) {
    return null;
  }

  return (
    <AppDataContextProvider
      currentUserId={jamesContact.id}
      contacts={initialContacts}
    >
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <ChannelOptionsSheetContent
            chatTitle={`Test Channel (${hostStatus})`}
            channel={mock.channel}
            onPressNotifications={() => {}}
            onOpenChange={() => {}}
          />
        </ChatOptionsProvider>
      </FixtureWrapper>
    </AppDataContextProvider>
  );
};

/**
 * Group options fixture component
 * Shows how the group options sheet appears in different states
 */
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
  });

  const hostStatus = isHost ? "you're the host" : "you're a member";
  const titleWithPrivacy = `${privacy.charAt(0).toUpperCase() + privacy.slice(1)} Group (${hostStatus})`;

  // Make sure we have a valid group and groupUnread
  if (!mock.group) {
    return null;
  }

  return (
    <AppDataContextProvider
      currentUserId={jamesContact.id}
      contacts={initialContacts}
    >
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <GroupOptionsSheetContent
            chatTitle={titleWithPrivacy}
            group={mock.group}
            groupUnread={mock.groupUnread || null}
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

/**
 * DM options fixture component
 * Shows the options for both individual DMs and group DMs
 */
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
  });

  const title =
    dmType === 'dm' ? 'Direct Message' : `Group DM (${memberCount} members)`;

  // Make sure we have a valid channel
  if (!mock.channel) {
    return null;
  }

  return (
    <AppDataContextProvider
      currentUserId={jamesContact.id}
      contacts={initialContacts}
    >
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
