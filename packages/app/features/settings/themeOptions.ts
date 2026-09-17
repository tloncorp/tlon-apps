import { AppTheme } from '../../types/theme';
import { ListItemInputOption } from '../../ui';

export const THEME_OPTIONS: ListItemInputOption<AppTheme>[] = [
  {
    title: 'Auto',
    value: 'auto',
    subtitle: 'Uses your system appearance',
  },
  { title: 'Tlon Light', value: 'light' },
  { title: 'Tlon Dark', value: 'dark' },
  { title: 'Dracula', value: 'dracula' },
  { title: 'Greenscreen', value: 'greenscreen' },
  { title: 'Gruvbox', value: 'gruvbox' },
  { title: 'Monokai', value: 'monokai' },
  { title: 'Nord', value: 'nord' },
  { title: 'Peony', value: 'peony' },
  { title: 'Solarized', value: 'solarized' },
];

/** The name the Appearance screen gives a theme, for the Settings row's value. */
export function themeLabel(theme: AppTheme): string | undefined {
  return THEME_OPTIONS.find((option) => option.value === theme)?.title;
}
