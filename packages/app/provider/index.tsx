import { subscribeToSettings } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import { syncSettings, updateTheme } from '@tloncorp/shared/store';
import React, { useEffect, useState } from 'react';
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

  // Effect to sync with backend theme settings and subscribe to changes
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // First try to get from local storage
        const storedTheme = await themeSettings.getValue();

        // Then sync with backend to ensure we have the latest
        await syncSettings();

        // After sync, check if theme value changed
        const updatedTheme = await themeSettings.getValue();

        if (updatedTheme) {
          // If we have a specific theme, use it
          setActiveTheme(updatedTheme);
        } else {
          // If we have null/auto, use system theme
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    };

    // Load theme immediately
    loadTheme();

    // Set up subscription to settings changes
    subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme as ThemeName | 'auto' | null | '';
        console.log('Theme updated from backend:', newTheme);

        // Update local storage - treat empty string as null (auto theme)
        const localTheme =
          !newTheme || newTheme === 'auto' || (newTheme as any) === ''
            ? null
            : newTheme;
        themeSettings
          .setValue(localTheme)
          .catch((err) =>
            console.warn('Failed to update local theme setting:', err)
          );

        // Apply theme change to UI
        if (!newTheme || newTheme === 'auto' || (newTheme as any) === '') {
          // For auto theme, respect system setting
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        } else {
          // Otherwise use the specific theme
          setActiveTheme(newTheme as ThemeName);
        }
      }
    });

    // No cleanup needed for settings subscription
    return () => {
      // Nothing to clean up
    };
  }, [isDarkMode]);

  // Handle system theme changes when in auto mode
  useEffect(() => {
    const applySystemThemeIfAuto = async () => {
      try {
        const storedTheme = await themeSettings.getValue();
        if (!storedTheme) {
          // If in auto mode (null theme), update to match system
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
    // Save to local storage
    await themeSettings.setValue(theme);

    // Update the active theme in UI
    setActiveTheme(theme);

    // Sync with backend
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
    // Clear local storage
    await themeSettings.resetValue();

    // Update UI based on system theme
    setActiveTheme(isDarkMode ? 'dark' : 'light');

    // Update backend to null/auto theme
    await updateTheme('auto' as any);
  } catch (error) {
    console.warn('Failed to clear theme preference:', error);
  }
};

export const useActiveTheme = () => {
  const { activeTheme } = React.useContext(ThemeContext);
  return activeTheme;
};
