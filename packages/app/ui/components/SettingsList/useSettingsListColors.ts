import { useMemo } from 'react';
import { getTokenValue, useTheme } from 'tamagui';

import { useIsDarkMode } from '../../../hooks/useDarkMode';
import { useSettingsListSurfaces } from './settingsListSurfaces';

/**
 * The active Tlon theme resolved to plain colors for the native lists, which
 * draw outside Tamagui. The page and rows follow `useSettingsListSurfaces`.
 */
export function useSettingsListColors() {
  const theme = useTheme();
  const isDark = useIsDarkMode();
  const surfaces = useSettingsListSurfaces();

  return useMemo(() => {
    const pageKey = surfaces.page.slice(1) as
      | 'background'
      | 'secondaryBackground';
    const cardKey = surfaces.card.slice(1) as
      | 'background'
      | 'secondaryBackground';
    return {
      colorScheme: isDark ? ('dark' as const) : ('light' as const),
      page: theme[pageKey].val,
      row: theme[cardKey].val,
      // Warm like the rest of the palette; the platforms' own separator grays
      // are cool and read as off against it.
      separator: theme.secondaryBorder.val,
      primaryText: theme.primaryText.val,
      secondaryText: theme.secondaryText.val,
      tertiaryText: theme.tertiaryText.val,
      accent: theme.positiveActionText.val,
      negative: theme.negativeActionText.val,
      pending: {
        text: getTokenValue('$orange', 'color'),
        // The soft orange is a fixed pale tint that glows on dark cards; there
        // a wash of the orange itself sits with the card instead.
        background: isDark
          ? withAlpha(getTokenValue('$orange', 'color'), 0.2)
          : getTokenValue('$orangeSoft', 'color'),
      },
    };
  }, [isDark, surfaces, theme]);
}

export type SettingsListColors = ReturnType<typeof useSettingsListColors>;

/** A `#RRGGBB` color at the given opacity. */
function withAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
