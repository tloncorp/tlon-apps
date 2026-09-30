import { useMemo } from 'react';
import { getTokenValue, useTheme } from 'tamagui';

import { useIsDarkMode } from '../../../hooks/useDarkMode';

/**
 * The active Tlon theme resolved to plain colors for the native lists, which
 * draw outside Tamagui. Grouped rows sit on the primary background over a page
 * in the secondary one (`settingsListPageColor`), in every theme.
 */
export function useSettingsListColors() {
  const theme = useTheme();
  const isDark = useIsDarkMode();

  return useMemo(() => {
    return {
      colorScheme: isDark ? ('dark' as const) : ('light' as const),
      page: theme.secondaryBackground.val,
      row: theme.background.val,
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
        background: getTokenValue('$orangeSoft', 'color'),
      },
    };
  }, [isDark, theme]);
}

export type SettingsListColors = ReturnType<typeof useSettingsListColors>;
