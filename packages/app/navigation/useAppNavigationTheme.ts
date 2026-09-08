import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { useMemo } from 'react';
import { getTokenValue } from 'tamagui';

import { useIsDarkMode } from '../hooks/useDarkMode';
import { useTheme } from '../ui';

export function useAppNavigationTheme(): Theme {
  const theme = useTheme();
  const isDark = useIsDarkMode();
  const background = theme.background?.val;
  const text = theme.primaryText?.val;
  const border = theme.border?.val;

  return useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: text ?? baseTheme.colors.primary,
        background: background ?? baseTheme.colors.background,
        card: background ?? baseTheme.colors.card,
        text: text ?? baseTheme.colors.text,
        border: border ?? baseTheme.colors.border,
        notification: getTokenValue('$blue', 'color'),
      },
    };
  }, [background, border, isDark, text]);
}
