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
  ...rest
}: Omit<TamaguiProviderProps, 'config'>) {
  return (
    <ThemeProviderContent tamaguiProps={rest}>{children}</ThemeProviderContent>
  );
}

function ThemeProviderContent({
  children,
  tamaguiProps,
}: {
  children: React.ReactNode;
  tamaguiProps: Omit<TamaguiProviderProps, 'config'>;
}) {
  const { activeTheme, appTheme } = useResolvedAppTheme();

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

function useResolvedAppTheme() {
  const isSystemDarkMode = useIsSystemDarkMode();
  const { data: storedThemeRaw, isLoading } = store.useThemeSettings();
  const appTheme: AppTheme | null = isLoading
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
