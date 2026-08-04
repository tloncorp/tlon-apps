import * as store from '@tloncorp/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode, useIsSystemDarkMode } from '../hooks/useDarkMode';
import { SplashScreenTask, splashScreenProgress } from '../lib/splashscreen';
import { AppTheme } from '../types/theme';
import { config } from '../ui/tamagui.config';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

const ThemeContext = React.createContext<{
  activeTheme: AppTheme;
}>({ activeTheme: 'light' });

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
  const [activeTheme, , appTheme] = useSyncedAppTheme();

  return (
    <ThemeContext.Provider
      value={useMemo(() => ({ activeTheme }), [activeTheme])}
    >
      <TamaguiProvider
        {...tamaguiProps}
        config={config}
        defaultTheme={activeTheme}
      >
        <NativeAppearanceSync appTheme={appTheme} />
        {children}
      </TamaguiProvider>
    </ThemeContext.Provider>
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

export const useActiveTheme = () => {
  const { activeTheme } = React.useContext(ThemeContext);
  return activeTheme;
};

function useSyncedAppTheme() {
  const isDarkMode = useIsSystemDarkMode();
  const [activeTheme, setActiveTheme] = useState<AppTheme>(
    isDarkMode ? 'dark' : 'light'
  );

  // Query database for which theme the user has previously set
  const { data: storedThemeRaw, isLoading } = store.useThemeSettings();

  const storedTheme = useMemo(() => {
    if (isLoading) {
      return { loaded: false } as const;
    }
    const appTheme =
      storedThemeRaw == null ? 'auto' : normalizeTheme(storedThemeRaw);
    const tamaguiTheme = getDisplayTheme(appTheme, isDarkMode);
    return {
      loaded: true,

      /** `AppTheme` specified in settings - includes `auto`, which resolves to
       * another theme at runtime. */
      appTheme,

      /** Resolved Tamagui `ThemeName` derived from `appTheme` - maps
       * one-to-one with color set */
      tamaguiTheme,
    } as const;
  }, [isLoading, storedThemeRaw, isDarkMode]);

  // Apply stored theme
  useEffect(() => {
    if (!storedTheme.loaded) {
      return;
    }

    setActiveTheme(storedTheme.tamaguiTheme);
    splashScreenProgress.complete(SplashScreenTask.loadTheme);
  }, [storedTheme]);

  return [
    activeTheme,
    setActiveTheme,
    storedTheme.loaded ? storedTheme.appTheme : null,
  ] as const;
}
