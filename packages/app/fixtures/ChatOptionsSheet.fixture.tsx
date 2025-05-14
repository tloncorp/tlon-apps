import * as db from '@tloncorp/shared/db';
import { useSelect, useValue } from 'react-cosmos/client';

import {
  ChannelOptionsSheetContent,
  GroupOptionsSheetContent,
} from '../ui/components/ChatOptionsSheet';
import { AppDataContextProvider } from '../ui/contexts/appDataContext';
import { ChatOptionsProvider } from '../ui/contexts/chatOptions';
import { FixtureWrapper } from './FixtureWrapper';

const mockChannel = (isHost: boolean) =>
  ({
    id: 'chat/~sampel-palnet/test-channel',
    type: 'chat',
    title: 'Test Channel',
    groupId: 'group/~sampel-palnet/test-group',
    currentUserIsMember: true,
    currentUserIsHost: isHost,
    unreadCount: 0,
  }) as db.Channel;

const mockDM = (isDM: 'dm' | 'groupDm', contactsCount = 1) => {
  const members = Array.from({ length: contactsCount }, (_, i) => ({
    contactId: `~${i === 0 ? 'sampel-palnet' : i}`,
    membershipType: 'channel',
  }));

  return {
    id: `${isDM}/~sampel-palnet/${isDM === 'dm' ? 'direct-chat' : 'group-chat'}`,
    type: isDM,
    title: isDM === 'dm' ? undefined : 'Club',
    groupId: undefined,
    currentUserIsMember: true,
    currentUserIsHost: false,
    unreadCount: 0,
    contactId: isDM === 'dm' ? '~zod' : undefined,
    members: isDM === 'groupDm' ? members : undefined,
  } as db.Channel;
};

const mockGroup = (isHost: boolean, privacy: 'public' | 'private' | 'secret') =>
  ({
    id: 'group/~sampel-palnet/test-group',
    title: 'Test Group',
    privacy,
    currentUserIsMember: true,
    currentUserIsHost: isHost,
    hostUserId: '~sampel-palnet',
    members: [],
  }) as db.Group;

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

  return (
    <AppDataContextProvider>
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <ChannelOptionsSheetContent
            chatTitle={`Test Channel (${isHost ? "you're the host" : "you're a member"})`}
            channel={mockChannel(isHost)}
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
  const [privacy] = useSelect('Privacy', {
    options: ['public', 'private', 'secret'],
    defaultValue: 'public',
  });

  return (
    <AppDataContextProvider>
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <GroupOptionsSheetContent
            chatTitle={`${privacy.charAt(0).toUpperCase() + privacy.slice(1)} Group (${isHost ? "you're the host" : "you're a member"})`}
            group={mockGroup(
              isHost,
              privacy as 'public' | 'private' | 'secret'
            )}
            groupUnread={null}
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

  const title =
    dmType === 'dm' ? 'Direct Message' : `Group DM (${memberCount} members)`;

  return (
    <AppDataContextProvider>
      <FixtureWrapper>
        <ChatOptionsProvider {...mockFunctions}>
          <ChannelOptionsSheetContent
            chatTitle={title}
            channel={mockDM(dmType as 'dm' | 'groupDm', memberCount)}
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
