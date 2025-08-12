import * as store from '@tloncorp/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { SplashScreenTask, splashScreenProgress } from '../lib/splashscreen';
import { AppTheme } from '../types/theme';
import { config } from '../ui';
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
  const [activeTheme] = useSyncedAppTheme();

  return (
    <ThemeContext.Provider
      value={useMemo(() => ({ activeTheme }), [activeTheme])}
    >
      <TamaguiProvider
        {...tamaguiProps}
        config={config}
        defaultTheme={activeTheme}
      >
        {children}
      </TamaguiProvider>
    </ThemeContext.Provider>
  );
}

export const useActiveTheme = () => {
  const { activeTheme } = React.useContext(ThemeContext);
  return activeTheme;
};

function useSyncedAppTheme() {
  const isDarkMode = useIsDarkMode();
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

  return [activeTheme, setActiveTheme] as const;
}
