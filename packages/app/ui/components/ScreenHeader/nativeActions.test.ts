import { describe, expect, it, vi } from 'vitest';

import { buildNativeHeaderItem } from './nativeActions';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('tamagui', () => ({ useTheme: vi.fn() }));
vi.mock('./primitives', () => ({ ScreenHeaderItemElements: () => null }));

describe('native header actions', () => {
  it('derives the asset name and prefers the shared test identifier', () => {
    expect(
      buildNativeHeaderItem({
        kind: 'icon',
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
        kind: 'text',
        id: 'rename',
        text: 'Rename',
      })
    ).toMatchObject({ identifier: 'rename' });
  });
});
