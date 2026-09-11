import * as store from '@tloncorp/shared';
import React, { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode, useIsSystemDarkMode } from '../hooks/useDarkMode';
import { SplashScreenTask, splashScreenProgress } from '../lib/splashscreen';
import { AppTheme } from '../types/theme';
import { config } from '../ui/tamagui.config';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

export function Provider({
  children,
  migrationsSucceeded = true,
  ...rest
}: Omit<TamaguiProviderProps, 'config'> & { migrationsSucceeded?: boolean }) {
  return (
    <ThemeProviderContent
      tamaguiProps={rest}
      migrationsSucceeded={migrationsSucceeded}
    >
      {children}
    </ThemeProviderContent>
  );
}

function ThemeProviderContent({
  children,
  tamaguiProps,
  migrationsSucceeded,
}: {
  children: React.ReactNode;
  tamaguiProps: Omit<TamaguiProviderProps, 'config'>;
  migrationsSucceeded: boolean;
}) {
  const { activeTheme, appTheme } = useResolvedAppTheme(migrationsSucceeded);

  return (
    <TamaguiProvider
      {...tamaguiProps}
      config={config}
      defaultTheme={activeTheme}
    >
      <NativeAppearanceSync appTheme={appTheme} />
      {children}
    </TamaguiProvider>
  );
}

function NativeAppearanceSync({ appTheme }: { appTheme: AppTheme | null }) {
  const isDarkTheme = useIsDarkMode();

  useEffect(() => {
    if (Platform.OS !== 'ios' || appTheme == null) {
      return;
    }

    Appearance.setColorScheme(
      appTheme === 'auto' ? 'unspecified' : isDarkTheme ? 'dark' : 'light'
    );
  }, [appTheme, isDarkTheme]);

  return null;
}

function useResolvedAppTheme(migrationsSucceeded: boolean) {
  const isSystemDarkMode = useIsSystemDarkMode();
  // The settings table only exists once migrations have run, so keep the read
  // disabled until then. While disabled, react-query reports `isLoading: false`
  // but leaves `isPending` true, so `isPending` is what means "no theme yet".
  const { data: storedThemeRaw, isPending } = store.useThemeSettings({
    enabled: migrationsSucceeded,
  });
  const appTheme: AppTheme | null = isPending
    ? null
    : storedThemeRaw == null
      ? 'auto'
      : normalizeTheme(storedThemeRaw);
  const activeTheme =
    appTheme == null
      ? isSystemDarkMode
        ? 'dark'
        : 'light'
      : getDisplayTheme(appTheme, isSystemDarkMode);

  useEffect(() => {
    if (appTheme == null) {
      return;
    }

    splashScreenProgress.complete(SplashScreenTask.loadTheme);
  }, [appTheme]);

  return { activeTheme, appTheme };
}
