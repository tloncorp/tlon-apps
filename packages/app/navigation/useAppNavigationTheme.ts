import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTheme } from 'tamagui';

import { useIsDarkTheme } from '../ui/utils/colorUtils';

export function useAppNavigationTheme() {
  const theme = useTheme();
  const isDark = useIsDarkTheme();
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
      },
    };
  }, [background, border, isDark, text]);
}
