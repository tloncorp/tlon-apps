import { syncSettings, updateTheme, useThemeSettings } from '@tloncorp/shared';
import { subscribeToSettings } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import React, { useCallback, useEffect, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { AppTheme } from '../types/theme';
import { DARK_THEME_NAMES, config } from '../ui';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

export interface ThemeContextType {
  setActiveTheme: (theme: AppTheme) => Promise<void>;
  activeTheme: AppTheme;
  systemIsDark: boolean;
  themeIsDark: boolean;
}

export const ThemeContext = React.createContext<ThemeContextType>({
  setActiveTheme: async () => {},
  activeTheme: 'light',
  systemIsDark: false,
  themeIsDark: false,
});

export function Provider({
  children,
  ...tamaguiProps
}: Omit<TamaguiProviderProps, 'config'>) {
  const systemIsDark = useIsDarkMode();
  const [activeTheme, setActiveThemeState] = useState<AppTheme>(
    systemIsDark ? 'dark' : 'light'
  );

  const themeIsDark = DARK_THEME_NAMES.includes(activeTheme as any);

  const { data: storedTheme, isLoading, refetch } = useThemeSettings();

  const setActiveTheme = useCallback(
    async (theme: AppTheme) => {
      try {
        setActiveThemeState(theme);

        if (theme === 'auto') {
          await updateTheme('auto');
        } else {
          await updateTheme(theme);
        }

        await refetch();
      } catch (error) {
        console.warn('Failed to save theme preference:', error);
      }
    },
    [refetch]
  );

  useEffect(() => {
    const loadTheme = async () => {
      try {
        await syncSettings();
        if (!isLoading && storedTheme !== undefined) {
          const normalizedTheme = normalizeTheme(storedTheme);
          setActiveThemeState(getDisplayTheme(normalizedTheme, systemIsDark));
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    };

    loadTheme();
  }, [systemIsDark, isLoading, storedTheme]);

  useEffect(() => {
    subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme;
        const normalizedTheme = normalizeTheme(newTheme as string);

        setActiveThemeState(getDisplayTheme(normalizedTheme, systemIsDark));

        themeSettings
          .setValue(normalizedTheme === 'auto' ? null : normalizedTheme)
          .catch((err) =>
            console.warn('Failed to update local theme setting:', err)
          );

        refetch();
      }
    });

    syncSettings().catch((err) =>
      console.warn('Initial settings sync failed:', err)
    );
  }, [systemIsDark, refetch]);

  useEffect(() => {
    if (!isLoading && !storedTheme) {
      setActiveThemeState(systemIsDark ? 'dark' : 'light');
    }
  }, [systemIsDark, isLoading, storedTheme]);

  return (
    <ThemeContext.Provider
      value={{ setActiveTheme, activeTheme, systemIsDark, themeIsDark }}
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
  const { activeTheme, setActiveTheme, systemIsDark, themeIsDark } =
    React.useContext(ThemeContext);
  return { activeTheme, setActiveTheme, systemIsDark, themeIsDark };
};

export const useIsThemeDark = () => {
  const { themeIsDark } = React.useContext(ThemeContext);
  return themeIsDark;
};
