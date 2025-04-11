import { themeSettings } from '@tloncorp/shared/db';
import { useEffect, useState } from 'react';
import React from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';
import type { ThemeName } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { config } from '../ui';

export const ThemeContext = React.createContext<{
  setActiveTheme: (theme: ThemeName) => void;
  activeTheme: ThemeName;
}>({ setActiveTheme: () => {}, activeTheme: 'light' });

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
        const storedTheme = await themeSettings.getValue();
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

  useEffect(() => {
    const handleSystemThemeChange = async () => {
      try {
        const storedTheme = await themeSettings.getValue();
        if (!storedTheme) {
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to check theme preference:', error);
      }
    };

    handleSystemThemeChange();
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
    await themeSettings.setValue(theme);
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
    await themeSettings.resetValue();
    setActiveTheme(isDarkMode ? 'dark' : 'light');
  } catch (error) {
    console.warn('Failed to clear theme preference:', error);
  }
};

export const useActiveTheme = () => {
  const { activeTheme } = React.useContext(ThemeContext);
  return activeTheme;
};
