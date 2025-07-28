import { getStateFromPath } from '@react-navigation/core';
import { describe, expect, test } from 'vitest';

import {
  NavigationIntent,
  getNavigationIntentFromState,
  getStateFromNavigationIntent,
} from './intent';
import { getDesktopLinkingConfig, getMobileLinkingConfig } from './linking';

type NavigatorMode = 'mobile' | 'desktop';

function getRouteFromPath(path: string, mode: NavigatorMode) {
  const navState =
    mode === 'mobile'
      ? getStateFromPath(path, getMobileLinkingConfig('').config!)
      : getStateFromPath(path, getDesktopLinkingConfig('').config!);
  if (navState == null) {
    throw new Error('No nav state');
  }
  return getNavigationIntentFromState(
    // @ts-expect-error - `getStateFromPath` from react-navigation doesn't give
    // us enough detail in its return type
    navState,
    mode
  );
}

function checkIsConversionStable(intent: NavigationIntent) {
  for (const platform of ['mobile', 'desktop'] as const) {
    const derivedState = getStateFromNavigationIntent(intent, platform);
    expect(derivedState).toBeTruthy();
    const derivedIntent = getNavigationIntentFromState(derivedState!, platform);
    expect(derivedIntent).toEqual(intent);
  }
}

describe('getNavigationIntentFromRoute', () => {
  test('channel list', () => {
    checkIsConversionStable({ feature: 'channel-list' });
    expect(getRouteFromPath('/apps/groups/', 'desktop')).toEqual({
      feature: 'channel-list',
    });
    expect(getRouteFromPath('/apps/groups/ChatList', 'mobile')).toEqual({
      feature: 'channel-list',
    });
  });

  test('channel', () => {
    checkIsConversionStable({
      feature: 'channel',
      params: {
        groupId: '~my-group',
        channelId: '~my-channel',
        selectedPostId: undefined,
      },
    });

    expect(
      getRouteFromPath(
        '/apps/groups/group/~my-group/channel/~my-channel/123.456',
        'mobile'
      )
    ).toEqual({
      feature: 'channel',
      params: {
        groupId: '~my-group',
        channelId: '~my-channel',
        selectedPostId: '123.456',
      },
    });

    expect(
      getRouteFromPath(
        '/apps/groups/group/~my-group/channel/~my-channel',
        'mobile'
      )
    ).toEqual({
      feature: 'channel',
      params: {
        groupId: '~my-group',
        channelId: '~my-channel',
        selectedPostId: undefined,
      },
    });

    expect(
      getRouteFromPath(
        '/apps/groups/group/~my-group/channel/~my-channel',
        'mobile'
      )
    ).toEqual({
      feature: 'channel',
      params: {
        groupId: '~my-group',
        channelId: '~my-channel',
        selectedPostId: undefined,
      },
    });
  });

  test('dm', () => {
    checkIsConversionStable({
      feature: 'dm',
      params: { channelId: '~some-user' },
    });
    expect(getRouteFromPath('/apps/groups/dm/~some-user', 'desktop')).toEqual({
      feature: 'dm',
      params: { channelId: '~some-user' },
    });
    expect(getRouteFromPath('/apps/groups/dm/~some-user', 'mobile')).toEqual({
      feature: 'dm',
      params: { channelId: '~some-user' },
    });
  });

  test('group dm', () => {
    checkIsConversionStable({
      feature: 'group-dm',
      params: { channelId: '~some-user' },
    });
    expect(
      getRouteFromPath('/apps/groups/group-dm/~some-user', 'desktop')
    ).toEqual({
      feature: 'group-dm',
      params: { channelId: '~some-user' },
    });
    expect(
      getRouteFromPath('/apps/groups/group-dm/~some-user', 'mobile')
    ).toEqual({
      feature: 'group-dm',
      params: { channelId: '~some-user' },
    });
  });

  test('settings', () => {
    checkIsConversionStable({ feature: 'settings' });
    expect(getRouteFromPath('/apps/groups/settings', 'desktop')).toEqual({
      feature: 'settings',
    });
    expect(getRouteFromPath('/apps/groups/settings', 'mobile')).toEqual({
      feature: 'settings',
    });
  });
});
