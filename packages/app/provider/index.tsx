import { syncSettings, updateTheme, useThemeSettings } from '@tloncorp/shared';
import { subscribeToSettings } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import { DARK_THEME_NAMES, config } from '@tloncorp/ui/config';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { AppTheme } from '../types/theme';
import { normalizeTheme } from '../ui/utils/themeUtils';

export interface ThemeContextType {
  setActiveTheme: (newTheme: AppTheme) => Promise<void>;
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

  const activeThemeRef = useRef(activeTheme);
  activeThemeRef.current = activeTheme;

  const themeIsDark = useMemo(() => {
    const displayTheme =
      activeTheme === 'auto' ? (systemIsDark ? 'dark' : 'light') : activeTheme;
    return DARK_THEME_NAMES.includes(displayTheme);
  }, [activeTheme, systemIsDark]);

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

  const displayTheme = useMemo(() => {
    return activeTheme === 'auto'
      ? systemIsDark
        ? 'dark'
        : 'light'
      : activeTheme;
  }, [activeTheme, systemIsDark]);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        await syncSettings();
        if (!isLoading && storedTheme !== undefined) {
          const normalizedTheme = normalizeTheme(storedTheme);
          if (normalizedTheme !== activeThemeRef.current) {
            setActiveThemeState(normalizedTheme);
          }
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    };

    loadTheme();
  }, [systemIsDark, isLoading, storedTheme]);

  useEffect(() => {
    const unsubscribe = subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme;
        const normalizedTheme = normalizeTheme(newTheme as string);

        setActiveThemeState(normalizedTheme);

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

    return unsubscribe;
  }, [systemIsDark, refetch]);

  useEffect(() => {
    if (!isLoading && !storedTheme) {
      const defaultTheme = systemIsDark ? 'dark' : 'light';
      if (activeThemeRef.current !== defaultTheme) {
        setActiveThemeState(defaultTheme);
      }
    }
  }, [systemIsDark, isLoading, storedTheme]);

  return (
    <ThemeContext.Provider
      value={{ setActiveTheme, activeTheme, systemIsDark, themeIsDark }}
    >
      <TamaguiProvider
        {...tamaguiProps}
        config={config}
        defaultTheme={displayTheme}
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
