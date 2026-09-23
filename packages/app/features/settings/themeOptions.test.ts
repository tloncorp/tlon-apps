import { describe, expect, it } from 'vitest';

import { AppTheme } from '../../types/theme';
import { THEME_OPTIONS, themeLabel } from './themeOptions';

// Naming every theme here means adding one to the AppTheme union without
// giving it an option fails to compile, rather than silently dropping the
// Appearance row's subtitle for whoever picks it.
const ALL_THEMES: Record<AppTheme, true> = {
  auto: true,
  light: true,
  dark: true,
  dracula: true,
  greenscreen: true,
  gruvbox: true,
  monokai: true,
  nord: true,
  peony: true,
  solarized: true,
};

describe('themeLabel', () => {
  it('names every theme a user can choose', () => {
    const missing = (Object.keys(ALL_THEMES) as AppTheme[]).filter(
      (theme) => !themeLabel(theme)
    );

    expect(missing).toEqual([]);
  });

  it('gives the Settings row the same name the Appearance screen lists', () => {
    expect(themeLabel('auto')).toBe('Auto');
    expect(themeLabel('light')).toBe(
      THEME_OPTIONS.find((option) => option.value === 'light')?.title
    );
  });
});
