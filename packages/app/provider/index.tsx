import { syncSettings, updateTheme, useThemeSettings } from '@tloncorp/shared';
import { subscribeToSettings } from '@tloncorp/shared/api';
import { queryClient } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import React, { useEffect, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { AppTheme } from '../types/theme';
import { config } from '../ui';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

export const ThemeContext = React.createContext<{
  setActiveTheme: (theme: AppTheme) => void;
  activeTheme: AppTheme;
}>({ setActiveTheme: () => {}, activeTheme: 'light' });

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
  const [activeTheme, setActiveTheme] = useSyncedAppTheme();
  return (
    <ThemeContext.Provider value={{ setActiveTheme, activeTheme }}>
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

export const setTheme = async (
  theme: AppTheme,
  setActiveTheme: (theme: AppTheme) => void
) => {
  try {
    setActiveTheme(theme);
    await updateTheme(theme);
  } catch (error) {
    console.warn('Failed to save theme preference:', error);
  }
};

export const clearTheme = async (
  setActiveTheme: (theme: AppTheme) => void,
  isDarkMode: boolean
) => {
  try {
    setActiveTheme(isDarkMode ? 'dark' : 'light');
    await updateTheme('auto');
  } catch (error) {
    console.warn('Failed to clear theme preference:', error);
  }
};

export const useActiveTheme = () => {
  const { activeTheme } = React.useContext(ThemeContext);
  return activeTheme;
};

function useSyncedAppTheme() {
  const isDarkMode = useIsDarkMode();
  const [activeTheme, setActiveTheme] = useState<AppTheme>(
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
  }, [isDarkMode, isLoading, storedTheme]);

  useEffect(() => {
    subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme;
        const normalizedTheme = normalizeTheme(newTheme as string);

        setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));

        themeSettings
          .setValue(normalizedTheme === 'auto' ? null : normalizedTheme)
          .catch((err) =>
            console.warn('Failed to update local theme setting:', err)
          );

        queryClient.invalidateQueries({ queryKey: ['themeSettings'] });
      }
    });
  }, [isDarkMode]);

  useEffect(() => {
    if (!isLoading && !storedTheme) {
      setActiveTheme(isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode, isLoading, storedTheme]);

  return [activeTheme, setActiveTheme] as const;
}
