/**
 * The shell ships exactly two themes (D30); the host maps the app's theme
 * to the nearer one. Exotic dark-background themes map to dark; anything
 * unknown falls back by name heuristic, defaulting light.
 */
const DARK_THEMES = new Set(['dark', 'dracula', 'gruvbox']);

export function shellThemeFromThemeName(
  themeName: string | undefined
): 'light' | 'dark' {
  if (themeName === undefined) {
    return 'light';
  }
  if (DARK_THEMES.has(themeName)) {
    return 'dark';
  }
  return themeName.toLowerCase().includes('dark') ? 'dark' : 'light';
}
