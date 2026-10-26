import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import {
  ChatDetailsScreenView,
  type ChatDetailsScreenViewProps,
} from './ChatDetailsScreenView';
import type { SettingsSectionModel } from './SettingsList';

vi.mock('@tloncorp/api/urbit', () => ({}));
vi.mock('@tloncorp/ui', () => ({
  ConfirmDialog: 'ConfirmDialog',
  Text: 'Text',
  pluralize: (_n: number, word: string) => word,
  useIsWindowNarrow: () => true,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  XStack: 'XStack',
  YStack: 'YStack',
}));
vi.mock('../contexts/appDataContext', () => ({
  useCalm: () => ({ disableNicknames: false }),
  useContactIndex: () => ({}),
}));
vi.mock('../utils', () => ({
  channelSupportsNotifications: () => false,
  getChannelActionCapabilities: () => ({}),
  getChannelHost: () => null,
  getChannelTitle: ({ channelTitle }: { channelTitle: string }) => channelTitle,
  getChannelTypeIcon: () => 'Channel',
  getGroupMemberCount: () => 0,
  useChatTitle: () => 'Chat',
  useGroupTitle: () => 'Workspace',
}));
vi.mock('./ListItem', () => ({
  ListItem: { GroupIcon: 'GroupIcon', ChannelIcon: 'ChannelIcon' },
}));
vi.mock('./NotificationLevelSelector', () => ({
  getLevelShortTitle: () => 'All',
  getNotificationLevelContext: () => ({}),
}));
vi.mock('./SettingsList', () => ({
  SETTINGS_LIST_COLUMN_WIDTH: 600,
  SettingsListScreenView: 'SettingsListScreenView',
}));
vi.mock('./UserProfileScreenView', () => ({ ProfileButton: 'ProfileButton' }));

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

it('keeps next-app channel navigation and permission-gated creation in the new cards', () => {
  const channel = {
    id: 'chat/~zod/other',
    title: 'Other',
    type: 'chat',
  } as db.Channel;
  const onPressChannel = vi.fn();
  const onPressNewChannel = vi.fn();
  const props: ChatDetailsScreenViewProps = {
    chatType: 'channel',
    channel: {
      id: 'chat/~zod/current',
      groupId: '~zod/workspace',
      type: 'chat',
    } as db.Channel,
    group: { id: '~zod/workspace' } as db.Group,
    currentUserId: '~zod',
    currentUserIsAdmin: true,
    hostStatus: { complete: true, status: 'yes' },
    roleCount: 1,
    channelMenu: {
      title: 'Other channels in this workspace',
      channels: [channel],
    },
    onPressChannel,
    onPressNewChannel,
    onGoBack: vi.fn(),
    onPressEdit: vi.fn(),
    onMarkRead: vi.fn(),
    onTogglePinned: vi.fn(),
    onForward: vi.fn(),
    onCopyGroupId: vi.fn(),
    onCopyText: vi.fn(),
    onPressPrivacy: vi.fn(),
    onPressRoles: vi.fn(),
    onPressChannels: vi.fn(),
    onPressNotifications: vi.fn(),
    onPressScheduledTasks: vi.fn(),
    onPressChannelPermissions: vi.fn(),
    onPressProfile: vi.fn(),
    onMessageContact: vi.fn(),
    onPressAllMembers: vi.fn(),
    onLeave: vi.fn(),
    onDelete: vi.fn(),
  };
  let renderer: ReactTestRenderer;
  const section = () =>
    (
      renderer!.root.findByType('SettingsListScreenView' as never).props
        .sections as SettingsSectionModel[]
    ).find((s) => s.key === 'channel-navigation');
  act(() => {
    renderer = create(<ChatDetailsScreenView {...props} />);
  });
  expect(section()?.title).toBe('Other channels in this workspace');
  expect(section()?.rows.map((r) => r.testID)).toEqual([
    'ChatDetailsChannel-chat/~zod/other',
    'ChatDetailsNewChannelButton',
  ]);
  section()!.rows[0].onPress!();
  section()!.rows[1].onPress!();
  expect(onPressChannel).toHaveBeenCalledWith(channel);
  expect(onPressNewChannel).toHaveBeenCalledOnce();

  for (const override of [
    { currentUserIsAdmin: false },
    { hostStatus: { complete: true, status: 'no' } },
  ]) {
    act(() => {
      renderer!.update(
        <ChatDetailsScreenView
          {...props}
          {...(override as Partial<ChatDetailsScreenViewProps>)}
        />
      );
    });
    expect(section()?.rows.map((r) => r.testID)).toEqual([
      'ChatDetailsChannel-chat/~zod/other',
    ]);
  }
  act(() => {
    renderer!.update(
      <ChatDetailsScreenView {...props} channelMenu={undefined} />
    );
  });
  expect(section()).toBeUndefined();
  act(() => {
    renderer!.unmount();
  });
});
