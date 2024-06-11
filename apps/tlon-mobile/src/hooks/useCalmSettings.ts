import * as store from '@tloncorp/shared/dist/store';

import { useCurrentUserId } from '../hooks/useCurrentUser';

export const useCalmSettings = () => {
  const currentUserId = useCurrentUserId();
  const calmSettingsQuery = store.useCalmSettings({
    userId: currentUserId,
  });

  console.log(calmSettingsQuery.data);

  return { calmSettings: calmSettingsQuery.data ?? null } as const;
};
