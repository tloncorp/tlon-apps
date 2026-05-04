import * as store from '@tloncorp/shared';
import {
  getCustomThemeRuntimeName,
  getThemePreferenceMode,
} from '@tloncorp/shared/utils';
import React, { useEffect, useMemo, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { SplashScreenTask, splashScreenProgress } from '../lib/splashscreen';
import { AppTheme } from '../types/theme';
import { config, registerCustomTheme } from '../ui/tamagui.config';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

const ThemeContext = React.createContext<{
  activeTheme: AppTheme;
  activeThemeIsDark: boolean;
}>({ activeTheme: 'light', activeThemeIsDark: false });

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
  const [activeTheme, activeThemeIsDark] = useSyncedAppTheme();

  return (
    <ThemeContext.Provider
      value={useMemo(
        () => ({ activeTheme, activeThemeIsDark }),
        [activeTheme, activeThemeIsDark]
      )}
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

export const useActiveThemeIsDark = () => {
  const { activeThemeIsDark } = React.useContext(ThemeContext);
  return activeThemeIsDark;
};

function useSyncedAppTheme() {
  const isDarkMode = useIsDarkMode();
  const [activeTheme, setActiveTheme] = useState<AppTheme>(
    isDarkMode ? 'dark' : 'light'
  );
  const [activeThemeIsDark, setActiveThemeIsDark] = useState(isDarkMode);

  // Query database for which theme the user has previously set
  const { data: storedThemeRaw, isLoading } = store.useThemeSettings();
  const {
    value: localThemePreference,
    isLoading: isLoadingLocalThemePreference,
  } = store.useLocalThemePreference();
  const { value: customThemes, isLoading: isLoadingCustomThemes } =
    store.useCustomThemes();

  const customThemeNames = useMemo(
    () => customThemes.map(getCustomThemeRuntimeName),
    [customThemes]
  );

  useEffect(() => {
    customThemes.forEach((customTheme) => {
      registerCustomTheme(
        getCustomThemeRuntimeName(customTheme),
        customTheme.theme
      );
    });
  }, [customThemes]);

  const storedTheme = useMemo(() => {
    if (isLoading || isLoadingLocalThemePreference || isLoadingCustomThemes) {
      return { loaded: false } as const;
    }
    const themePreference = localThemePreference ?? storedThemeRaw;
    const appTheme =
      themePreference == null
        ? 'auto'
        : normalizeTheme(themePreference, customThemeNames);
    const tamaguiTheme = getDisplayTheme(appTheme, isDarkMode);
    const mode = getThemePreferenceMode(appTheme, isDarkMode, customThemes);
    return {
      loaded: true,

      /** `AppTheme` specified in settings - includes `auto`, which resolves to
       * another theme at runtime. */
      appTheme,

      /** Resolved Tamagui `ThemeName` derived from `appTheme` - maps
       * one-to-one with color set */
      tamaguiTheme,

      /** Active visual mode, including custom themes and dark built-ins. */
      mode,
    } as const;
  }, [
    isLoading,
    isLoadingLocalThemePreference,
    isLoadingCustomThemes,
    localThemePreference,
    storedThemeRaw,
    customThemeNames,
    customThemes,
    isDarkMode,
  ]);

  // Apply stored theme
  useEffect(() => {
    if (!storedTheme.loaded) {
      return;
    }

    setActiveTheme(storedTheme.tamaguiTheme);
    setActiveThemeIsDark(storedTheme.mode === 'dark');
    splashScreenProgress.complete(SplashScreenTask.loadTheme);
  }, [storedTheme]);

  return [activeTheme, activeThemeIsDark] as const;
}
