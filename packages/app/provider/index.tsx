import { subscribeToSettings } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import { syncSettings, updateTheme, useSettings } from '@tloncorp/shared/store';
import React, { useEffect, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';
import type { ThemeName } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { config } from '../ui';

export const ThemeContext = React.createContext<{
  setActiveTheme: (theme: ThemeName) => void;
  activeTheme: ThemeName;
}>({ setActiveTheme: () => {}, activeTheme: 'light' });

export const normalizeTheme = (
  value: ThemeName | 'auto' | null | undefined | string
): 'auto' | ThemeName => {
  if (!value || value === 'auto' || value === '') return 'auto';
  return value as ThemeName;
};

const getDisplayTheme = (
  preference: 'auto' | ThemeName,
  isDarkMode: boolean
): ThemeName => {
  return preference === 'auto' ? (isDarkMode ? 'dark' : 'light') : preference;
};

export function Provider({
  children,
  ...rest
}: Omit<TamaguiProviderProps, 'config'>) {
  const isDarkMode = useIsDarkMode();
  const [activeTheme, setActiveTheme] = useState<ThemeName>(
    isDarkMode ? 'dark' : 'light'
  );

  let settingsQuery;
  try {
    settingsQuery = useSettings();
  } catch (err) {
    settingsQuery = { data: null, isLoading: true, error: err };
  }

  useEffect(() => {
    if (settingsQuery.data) {
      const normalizedTheme = normalizeTheme(settingsQuery.data.theme);
      setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));
    }
  }, [settingsQuery.data, isDarkMode]);

  useEffect(() => {
    if (settingsQuery.error) {
      const loadTheme = async () => {
        try {
          await syncSettings();
          const storedTheme = await themeSettings.getValue();
          const normalizedTheme = normalizeTheme(storedTheme);
          setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));
        } catch (error) {
          console.warn('Failed to load theme preference:', error);
        }
      };

      loadTheme();

      subscribeToSettings((update) => {
        if (update.type === 'updateSetting' && 'theme' in update.setting) {
          const newTheme = update.setting.theme;
          const normalizedTheme = normalizeTheme(newTheme as any);
          themeSettings
            .setValue(normalizedTheme === 'auto' ? null : normalizedTheme)
            .catch((err) =>
              console.warn('Failed to update local theme setting:', err)
            );

          // Apply theme to UI
          setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));
        }
      });
    }
  }, [settingsQuery.error, isDarkMode]);

  // Update theme when system preference changes in auto mode
  useEffect(() => {
    const applySystemThemeIfAuto = async () => {
      try {
        const storedTheme = await themeSettings.getValue();
        if (!storedTheme) {
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to check theme preference:', error);
      }
    };

    applySystemThemeIfAuto();
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ setActiveTheme, activeTheme }}>
      <TamaguiProvider {...rest} config={config} defaultTheme={activeTheme}>
        {children}
      </TamaguiProvider>
    </ThemeContext.Provider>
  );
}

export const setTheme = async (
  theme: ThemeName,
  setActiveTheme: (theme: ThemeName) => void
) => {
  try {
    setActiveTheme(theme);
    await updateTheme(theme as any);
  } catch (error) {
    console.warn('Failed to save theme preference:', error);
  }
};

export const clearTheme = async (
  setActiveTheme: (theme: ThemeName) => void,
  isDarkMode: boolean
) => {
  try {
    setActiveTheme(isDarkMode ? 'dark' : 'light');
    await updateTheme('auto' as any);
  } catch (error) {
    console.warn('Failed to clear theme preference:', error);
  }
};

export const useActiveTheme = () => {
  const { activeTheme } = React.useContext(ThemeContext);
  return activeTheme;
};
