import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';

import { getLevelTitle } from '../../ui/components/NotificationLevelSelector';
import { normalizeTheme } from '../../ui/utils/themeUtils';
import { themeLabel } from './themeOptions';

/**
 * Current values for the Settings rows that show one, so a row reads as
 * "Appearance — Tlon Light" rather than needing a tap to find out. Both labels
 * come from the screen the row opens, so the two never disagree.
 */
export function useSettingsRowLabels() {
  const { data: storedTheme, isLoading: themeLoading } = useThemeSettings();
  const baseVolumeLevel = store.useBaseVolumeLevel();

  return {
    themeLabel:
      themeLoading || storedTheme === undefined
        ? undefined
        : themeLabel(normalizeTheme(storedTheme)),
    // useBaseVolumeLevel falls back to 'medium' before the setting loads, which
    // is the same level the Notifications screen shows selected in that state.
    notificationsLabel: getLevelTitle(baseVolumeLevel, 'base') || undefined,
  };
}
