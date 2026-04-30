import {
  getCustomThemeName,
  isCustomThemeName,
  normalizeThemePreference,
} from '@tloncorp/shared/utils';
import { ThemeName } from 'tamagui';

import { AppTheme } from '../../types/theme';

export { getCustomThemeName, isCustomThemeName };

/**
 * Normalizes a theme string to a valid AppTheme..
 * Returns 'auto' if input is null or not a valid theme.
 */
export function normalizeTheme(
  theme: string | null,
  customThemeNames: string[] = []
): AppTheme {
  return normalizeThemePreference(theme, customThemeNames) as AppTheme;
}

/**
 * Converts a theme value to a display theme, handling 'auto' by using
 * the system dark mode preference.
 */
export function getDisplayTheme(
  theme: AppTheme,
  isDarkMode: boolean
): ThemeName {
  return (
    theme === 'auto' ? (isDarkMode ? 'dark' : 'light') : theme
  ) as ThemeName;
}
