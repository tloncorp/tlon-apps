import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useRootNavigation } from './utils';

const mocks = vi.hoisted(() => ({
  platform: 'web',
  narrow: false,
  navigation: { navigate: vi.fn() },
}));
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => mocks.navigation,
  CommonActions: {},
  StackActions: {},
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ log: vi.fn() }),
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('@tloncorp/shared/logic', async () => {
  const { useRef } = await import('react');
  return { useMutableRef: (value: unknown) => useRef(value) };
});
vi.mock('@tloncorp/ui', () => ({
  useIsWindowNarrow: () => mocks.narrow,
  useGlobalSearch: () => ({ lastOpenTab: 'Home' }),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
}));
vi.mock('../utils/botSettings', () => ({ openExternalBotSettings: vi.fn() }));

describe('saved login navigation', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { platform: 'android', narrow: false, desktop: false },
    { platform: 'ios', narrow: false, desktop: false },
    { platform: 'android', narrow: true, desktop: false },
    { platform: 'ios', narrow: true, desktop: false },
    { platform: 'web', narrow: true, desktop: false },
    { platform: 'web', narrow: false, desktop: true },
  ])(
    'opens the registered route for $platform (narrow=$narrow)',
    async ({ platform, narrow, desktop }) => {
      mocks.platform = platform;
      mocks.narrow = narrow;
      let navigate!: ReturnType<
        typeof useRootNavigation
      >['navigateToBotSavedLogins'];
      function Consumer() {
        const { navigateToBotSavedLogins } = useRootNavigation();
        useEffect(() => {
          navigate = navigateToBotSavedLogins;
        }, [navigateToBotSavedLogins]);
        return null;
      }
      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(<Consumer />);
      });
      const moon = '~marzod-botter-sampel-palnet';
      navigate(moon);
      navigate();
      expect(mocks.navigation.navigate.mock.calls).toEqual(
        desktop
          ? [
              [
                'Settings',
                { screen: 'BotSavedLogins', params: { moon } },
                { pop: true },
              ],
              [
                'Settings',
                { screen: 'BotSavedLogins', params: undefined },
                { pop: true },
              ],
            ]
          : [
              ['BotSavedLogins', { moon }],
              ['BotSavedLogins', undefined],
            ]
      );
      await act(async () => renderer.unmount());
    }
  );
});
