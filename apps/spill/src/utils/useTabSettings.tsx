import * as db from '@db';
import {useMemo} from 'react';

export function useTabSettings(settingsId: string, settingsIndex: number) {
  const groupSettings = db.useObject('TabGroupSettings', settingsId);
  return useTabSettingsWithDefaults(groupSettings?.tabs[settingsIndex]);
}

export function useTabSettingsWithDefaults(settings?: db.TabSettings | null) {
  return useMemo(() => tabSettingsWithDefaults(settings), [settings]);
}

export function tabSettingsWithDefaults(settings?: db.TabSettings | null) {
  const defaultSettings = db.TabSettings.default();
  return {
    icon: {...defaultSettings.icon, ...settings?.icon},
    query: {...defaultSettings.query, ...settings?.query},
    view: {...defaultSettings.view, ...settings?.view},
  };
}
