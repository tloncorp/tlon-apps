import { syncSettings, updateTheme, useThemeSettings } from '@tloncorp/shared';
import { subscribeToSettings } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import React, { useEffect, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';
import type { ThemeName } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { config } from '../ui';

export const ThemeContext = React.createContext<{
  setActiveTheme: (theme: ThemeName) => void;
  activeTheme: ThemeName;
}>({ setActiveTheme: () => {}, activeTheme: 'light' });

export function normalizeTheme(theme: string | null): ThemeName | 'auto' {
  if (!theme) return 'auto';
  const t = String(theme).toLowerCase();
  const validThemes: Record<string, ThemeName> = {
    light: 'light',
    dark: 'dark',
    dracula: 'dracula',
    greenscreen: 'greenscreen',
    gruvbox: 'gruvbox',
    monokai: 'monokai',
    nord: 'nord',
    peony: 'peony',
    solarized: 'solarized',
  };

  return validThemes[t] || 'auto';
}

export function getDisplayTheme(
  theme: ThemeName | 'auto',
  isDarkMode: boolean
): ThemeName {
  return theme === 'auto' ? (isDarkMode ? 'dark' : 'light') : theme;
}

export function Provider({
  children,
  ...rest
}: Omit<TamaguiProviderProps, 'config'>) {
  const isDarkMode = useIsDarkMode();
  const [activeTheme, setActiveTheme] = useState<ThemeName>(
    isDarkMode ? 'dark' : 'light'
  );

  const { data: storedTheme, isLoading } = useThemeSettings();

  useEffect(() => {
    const loadTheme = async () => {
      try {
        await syncSettings();
        if (!isLoading && storedTheme !== undefined) {
          const normalizedTheme = normalizeTheme(storedTheme);
          setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));
        }
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

        setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));
      }
    });
  }, [isDarkMode, isLoading, storedTheme]);

  useEffect(() => {
    const applySystemThemeIfAuto = async () => {
      try {
        if (!isLoading && !storedTheme) {
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to check theme preference:', error);
      }
    };

    applySystemThemeIfAuto();
  }, [isDarkMode, isLoading, storedTheme]);

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
