import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

const mocks = vi.hoisted(() => ({
  THEME_NODE: 'TamaguiProvider',
  useThemeSettings: vi.fn(),
  completeSplashTask: vi.fn(),
  setWindowBackgroundColor: vi.fn(),
  addAppStateListener: vi.fn(),
  removeAppStateListener: vi.fn(),
  backgroundColor: '#ffffff',
}));

vi.mock('react-native', () => ({
  Appearance: { setColorScheme: vi.fn() },
  Platform: { OS: 'web' },
  NativeModules: {
    TlonTheme: { setWindowBackgroundColor: mocks.setWindowBackgroundColor },
  },
  AppState: { addEventListener: mocks.addAppStateListener },
  processColor: (color: string) => parseInt(color.slice(1), 16) | 0xff000000,
}));

vi.mock('tamagui', async () => {
  const { createElement } =
    await vi.importActual<typeof import('react')>('react');
  return {
    useTheme: () => ({ background: { val: mocks.backgroundColor } }),
    TamaguiProvider: ({ children, defaultTheme }: any) =>
      createElement(mocks.THEME_NODE, { defaultTheme }, children),
  };
});

vi.mock('../ui/tamagui.config', () => ({ config: {} }));

vi.mock('../hooks/useDarkMode', () => ({
  useIsDarkMode: () => false,
  useIsSystemDarkMode: () => false,
}));

vi.mock('../lib/splashscreen', () => ({
  SplashScreenTask: { loadTheme: 'loadTheme' },
  splashScreenProgress: { complete: mocks.completeSplashTask },
}));

vi.mock('@tloncorp/shared', () => ({
  useThemeSettings: mocks.useThemeSettings,
}));

import { Provider } from './index';
import { Platform } from 'react-native';

// Mirrors react-query: a disabled query stays pending but never loads, so
// `isLoading` alone would read as "settled" and let the theme resolve early.
function queryStateFor({ enabled }: { enabled?: boolean } = {}) {
  return enabled
    ? { data: 'dark', isPending: false, isLoading: false }
    : { data: undefined, isPending: true, isLoading: false };
}

function themeOf(renderer: ReactTestRenderer) {
  return renderer.root.find(
    (node) => (node.type as unknown) === mocks.THEME_NODE
  ).props.defaultTheme;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useThemeSettings.mockImplementation(queryStateFor);
  Platform.OS = 'web';
  mocks.backgroundColor = '#ffffff';
  mocks.addAppStateListener.mockReturnValue({
    remove: mocks.removeAppStateListener,
  });
});

test('holds the settings read until migrations have succeeded', () => {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <Provider defaultTheme="light" migrationsSucceeded={false}>
        {null}
      </Provider>
    );
  });

  expect(mocks.useThemeSettings).toHaveBeenCalledWith({ enabled: false });
  // Theme is unresolved, so the splash task must stay open.
  expect(mocks.completeSplashTask).not.toHaveBeenCalled();
  expect(themeOf(renderer)).toBe('light');

  act(() => {
    renderer.update(
      <Provider defaultTheme="light" migrationsSucceeded={true}>
        {null}
      </Provider>
    );
  });

  expect(mocks.useThemeSettings).toHaveBeenLastCalledWith({ enabled: true });
  expect(themeOf(renderer)).toBe('dark');
  expect(mocks.completeSplashTask).toHaveBeenCalledTimes(1);
  expect(mocks.completeSplashTask).toHaveBeenCalledWith('loadTheme');
});

test('reads settings immediately when no migration state is supplied', () => {
  act(() => {
    create(<Provider defaultTheme="light">{null}</Provider>);
  });

  expect(mocks.useThemeSettings).toHaveBeenCalledWith({ enabled: true });
});

test('keeps the Android window background in sync with the app theme', () => {
  Platform.OS = 'android';
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Provider defaultTheme="light">{null}</Provider>);
  });
  expect(mocks.setWindowBackgroundColor).toHaveBeenLastCalledWith(-1);

  mocks.backgroundColor = '#1a1818';
  act(() => {
    renderer.update(<Provider defaultTheme="light">{null}</Provider>);
  });
  expect(mocks.setWindowBackgroundColor).toHaveBeenLastCalledWith(
    0xff1a1818 | 0
  );

  const onAppStateChange = mocks.addAppStateListener.mock.calls.at(-1)![1];
  mocks.setWindowBackgroundColor.mockClear();
  act(() => {
    onAppStateChange('background');
  });
  expect(mocks.setWindowBackgroundColor).not.toHaveBeenCalled();
  act(() => {
    onAppStateChange('active');
  });
  expect(mocks.setWindowBackgroundColor).toHaveBeenCalledWith(0xff1a1818 | 0);
  act(() => {
    renderer.unmount();
  });
  expect(mocks.removeAppStateListener).toHaveBeenCalled();
});

test('does not change the Android window until the app theme is resolved', () => {
  Platform.OS = 'android';
  act(() => {
    create(
      <Provider defaultTheme="light" migrationsSucceeded={false}>
        {null}
      </Provider>
    );
  });
  expect(mocks.setWindowBackgroundColor).not.toHaveBeenCalled();
});

test('does not apply the Android window background on other platforms', () => {
  act(() => {
    create(<Provider defaultTheme="light">{null}</Provider>);
  });
  expect(mocks.setWindowBackgroundColor).not.toHaveBeenCalled();
});
