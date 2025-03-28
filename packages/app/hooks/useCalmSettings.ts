import * as store from '@tloncorp/shared/store';

export const useCalmSettings = () => {
  const calmSettingsQuery = store.useCalmSettings();
  return { calmSettings: calmSettingsQuery.data ?? null } as const;
};
