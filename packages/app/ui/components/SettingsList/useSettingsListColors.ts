import { useMemo } from 'react';
import { getTokenValue, useTheme } from 'tamagui';

import { useIsDarkMode } from '../../../hooks/useDarkMode';
import type { SettingsRowStatus } from './types';

/**
 * The active Tlon theme resolved to plain colors for the native lists, which
 * draw outside Tamagui. Rows sit on the secondary background so each group
 * reads as a surface against the page, in every theme.
 */
export function useSettingsListColors() {
  const theme = useTheme();
  const isDark = useIsDarkMode();

  return useMemo(() => {
    const status: Record<
      SettingsRowStatus['tone'],
      { text: string; background: string }
    > = {
      positive: {
        text: theme.positiveActionText.val,
        background: theme.positiveBackground.val,
      },
      warning: {
        text: getTokenValue('$orange', 'color'),
        background: getTokenValue('$orangeSoft', 'color'),
      },
      neutral: {
        text: theme.secondaryText.val,
        background: theme.background.val,
      },
    };

    return {
      colorScheme: isDark ? ('dark' as const) : ('light' as const),
      page: theme.background.val,
      row: theme.secondaryBackground.val,
      border: theme.border.val,
      primaryText: theme.primaryText.val,
      secondaryText: theme.secondaryText.val,
      tertiaryText: theme.tertiaryText.val,
      accent: theme.positiveActionText.val,
      negative: theme.negativeActionText.val,
      status,
      pending: status.warning,
    };
  }, [isDark, theme]);
}

export type SettingsListColors = ReturnType<typeof useSettingsListColors>;
