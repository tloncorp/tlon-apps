import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import React from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';
import type { ThemeName } from 'tamagui';

import { THEME_STORAGE_KEY } from '../constants';
import { useIsDarkMode } from '../hooks/useIsDarkMode';

export const ThemeContext = React.createContext<{
  setActiveTheme: (theme: ThemeName) => void;
}>({ setActiveTheme: () => {} });

export function Provider({
  children,
  ...rest
}: Omit<TamaguiProviderProps, 'config'>) {
  const isDarkMode = useIsDarkMode();
  const [activeTheme, setActiveTheme] = useState<ThemeName>(
    isDarkMode ? 'dark' : 'light'
  );

  useEffect(() => {
    const loadStoredTheme = async () => {
      try {
        const storedTheme = (await AsyncStorage.getItem(
          THEME_STORAGE_KEY
        )) as ThemeName | null;
        if (storedTheme) {
          setActiveTheme(storedTheme);
        } else {
          // If no stored theme, follow system theme
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    };

    loadStoredTheme();
  }, [isDarkMode]);

  // Handle system theme changes
  useEffect(() => {
    const handleSystemThemeChange = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!storedTheme) {
          // Only update if in "auto" mode (no stored theme)
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to check theme preference:', error);
      }
    };

    handleSystemThemeChange();
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ setActiveTheme }}>
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
    await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    setActiveTheme(theme);
  } catch (error) {
    console.warn('Failed to save theme preference:', error);
  }
};

export const clearTheme = async (
  setActiveTheme: (theme: ThemeName) => void,
  isDarkMode: boolean
) => {
  try {
    await AsyncStorage.removeItem(THEME_STORAGE_KEY);
    setActiveTheme(isDarkMode ? 'dark' : 'light');
  } catch (error) {
    console.warn('Failed to clear theme preference:', error);
  }
};
