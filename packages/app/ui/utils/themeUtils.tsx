import { ThemeName } from 'tamagui';

import { AppTheme } from '../../types/theme';

/**
 * Normalizes a theme string to a valid AppTheme..
 * Returns 'auto' if input is null or not a valid theme.
 */
export function normalizeTheme(theme: string | null): AppTheme {
  if (!theme) return 'auto';
  const t = String(theme).toLowerCase();
  const validThemes: Record<string, ThemeName> = {
    light: 'light',
    dark: 'dark',
    dracula: 'dracula',
    greenscreen: 'greenscreen',
    gruvbox: 'gruvbox',
    monokai: 'monokai',
    nord: 'nord',
    peony: 'peony',
    solarized: 'solarized',
  };

  return validThemes[t] || 'auto';
}

/**
 * Converts a theme value to a display theme, handling 'auto' by using
 * the system dark mode preference.
 */
export function getDisplayTheme(
  theme: AppTheme,
  isDarkMode: boolean
): ThemeName {
  return theme === 'auto' ? (isDarkMode ? 'dark' : 'light') : theme;
}
