import * as store from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import React, { useEffect, useMemo, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { AppTheme } from '../types/theme';
import { config } from '../ui';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

export const ThemeContext = React.createContext<{
  /** Sets the root app theme - does not push to remote or persist to database. */
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
    <ThemeContext.Provider
      value={useMemo(
        () => ({ setActiveTheme, activeTheme }),
        [setActiveTheme, activeTheme]
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

export const setTheme = async (
  theme: AppTheme,
  setActiveTheme: (theme: AppTheme) => void
) => {
  try {
    setActiveTheme(theme);
    await store.updateTheme(theme);
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
    await store.updateTheme('auto');
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

  // Query database for which theme the user has previously set
  const { data: storedTheme, isLoading } = store.useThemeSettings();

  // Apply stored theme
  useEffect(() => {
    if (isLoading) {
      return;
    }
    const normalizedTheme =
      storedTheme == null ? 'auto' : normalizeTheme(storedTheme);
    setActiveTheme(getDisplayTheme(normalizedTheme, isDarkMode));
  }, [isLoading, storedTheme, isDarkMode]);

  useEffect(() => {
    (async () => {
      try {
        await store.pullSettings();
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    })();
  }, []);

  useEffect(() => {
    api.subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme;
        if (typeof newTheme !== 'string') {
          return;
        }
        const normalizedTheme = normalizeTheme(newTheme);

        // For simplicity, use the reactive DB query above to set the active
        // theme instead of setting it here.
        // // setActiveTheme(...);

        db.themeSettings
          .setValue(normalizedTheme === 'auto' ? null : normalizedTheme)
          .catch((err) =>
            console.warn('Failed to update local theme setting:', err)
          );
      }
    });
  }, []);

  return [activeTheme, setActiveTheme] as const;
}
