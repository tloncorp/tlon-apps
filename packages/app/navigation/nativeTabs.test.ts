import { describe, expect, test } from 'vitest';

import { getNativeTabRoute } from './nativeTabs';

describe('getNativeTabRoute', () => {
  test('preserves chat-list preview params through the compatibility route', () => {
    expect(
      getNativeTabRoute('ChatList', {
        previewGroupId: '~sample-group',
        previewGroupFromInviteNotification: true,
      })
    ).toEqual({
      name: 'MainTabs',
      params: {
        screen: 'ChatList',
        params: {
          previewGroupId: '~sample-group',
          previewGroupFromInviteNotification: true,
        },
      },
    });
  });

  test.each(['Activity', 'Contacts'] as const)(
    'builds the nested %s tab route',
    (screen) => {
      expect(getNativeTabRoute(screen, undefined)).toEqual({
        name: 'MainTabs',
        params: { screen, params: undefined },
      });
    }
  );
});
