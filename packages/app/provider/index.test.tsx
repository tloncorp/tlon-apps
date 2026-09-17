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
}));

vi.mock('react-native', () => ({
  Appearance: { setColorScheme: vi.fn() },
  Platform: { OS: 'web' },
}));

vi.mock('tamagui', async () => {
  const { createElement } =
    await vi.importActual<typeof import('react')>('react');
  return {
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
