import * as store from '@tloncorp/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { AppTheme } from '../types/theme';
import { config } from '../ui';
import { getDisplayTheme, normalizeTheme } from '../ui/utils/themeUtils';

const ThemeContext = React.createContext<{
  activeTheme: AppTheme;
}>({ activeTheme: 'light' });

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
  const [activeTheme] = useSyncedAppTheme();

  return (
    <ThemeContext.Provider
      value={useMemo(() => ({ activeTheme }), [activeTheme])}
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

  return [activeTheme, setActiveTheme] as const;
}
