import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { buildNativeHeaderItem } from './nativeActions';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('tamagui', () => ({ useTheme: vi.fn() }));
vi.mock('./primitives', () => ({ ScreenHeaderItemElements: () => null }));

describe('native header actions', () => {
  it('derives the asset name and prefers the shared test identifier', () => {
    expect(
      buildNativeHeaderItem({
        id: 'invite-people',
        icon: 'AddPerson',
        label: 'Invite people',
        onPress: vi.fn(),
        testID: 'InvitePeopleButton',
      })
    ).toMatchObject({
      identifier: 'InvitePeopleButton',
      icon: { source: { uri: 'TlonHeaderAddPerson' } },
    });
  });

  it('uses the action id when no test identifier is declared', () => {
    expect(
      buildNativeHeaderItem({
        id: 'rename',
        text: 'Rename',
      })
    ).toMatchObject({ identifier: 'rename' });
  });

  it('badges a button natively from iOS 26', () => {
    (Platform as { Version?: number }).Version = 26;
    expect(
      buildNativeHeaderItem({
        id: 'activity',
        icon: 'Notifications',
        label: 'Activity',
        onPress: vi.fn(),
        badge: 2,
        tint: '#0000ff',
      })
    ).toMatchObject({
      type: 'button',
      badge: { value: 2, style: { backgroundColor: '#0000ff' } },
    });
  });

  it('hosts a React badge button before iOS 26, where the native badge is ignored', () => {
    (Platform as { Version?: number }).Version = 17;
    const item = buildNativeHeaderItem({
      id: 'activity',
      icon: 'Notifications',
      label: 'Activity',
      onPress: vi.fn(),
      badge: 2,
      tint: '#0000ff',
    });
    expect(item).toMatchObject({ type: 'custom' });
    expect((item as { element?: unknown }).element).toBeTruthy();
  });

  it('leaves an unbadged button native on any iOS', () => {
    (Platform as { Version?: number }).Version = 17;
    expect(
      buildNativeHeaderItem({
        id: 'search',
        icon: 'Search',
        label: 'Search',
        onPress: vi.fn(),
      })
    ).toMatchObject({ type: 'button' });
  });

  it('preserves destructive styling for menu actions', () => {
    expect(
      buildNativeHeaderItem({
        id: 'options',
        icon: 'Overflow',
        label: 'More options',
        items: [
          {
            id: 'logout',
            label: 'Log out',
            destructive: true,
            onPress: vi.fn(),
          },
        ],
      })
    ).toMatchObject({
      menu: {
        items: [{ label: 'Log out', destructive: true }],
      },
    });
  });
});
