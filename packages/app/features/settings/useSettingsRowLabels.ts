import * as ub from '@tloncorp/api/urbit';
import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';

import { normalizeTheme } from '../../ui/utils/themeUtils';
import { themeLabel } from './themeOptions';

/**
 * Current values for the Settings rows that show one, so a row reads as
 * "Appearance — Tlon Light" rather than needing a tap to find out.
 */
export function useSettingsRowLabels() {
  const { data: storedTheme, isLoading: themeLoading } = useThemeSettings();
  const baseVolumeLevel = store.useBaseVolumeLevel();

  return {
    themeLabel:
      themeLoading || storedTheme === undefined
        ? undefined
        : themeLabel(normalizeTheme(storedTheme)),
    notificationsLabel: baseVolumeLevel
      ? ub.NotificationNamesShort[baseVolumeLevel]
      : undefined,
  };
}
