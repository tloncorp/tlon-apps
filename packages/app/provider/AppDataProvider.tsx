import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { extractNormalizedInviteLink } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { PropsWithChildren, useEffect } from 'react';

import {
  BRANCH_DOMAIN,
  BRANCH_KEY,
  INVITE_SERVICE_ENDPOINT,
  INVITE_SERVICE_IS_DEV,
} from '../constants';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { AppDataContextProvider } from '../ui';

export function AppDataProvider({
  webAppNeedsUpdate,
  triggerWebAppUpdate,
  inviteSystemContacts,
  children,
}: PropsWithChildren<{
  webAppNeedsUpdate?: boolean;
  triggerWebAppUpdate?: (returnToRoot?: boolean) => Promise<void>;
  inviteSystemContacts?: (
    params: domain.SystemContactInviteParams
  ) => Promise<boolean>;
}>) {
  const currentUserId = useCurrentUserId();
  const session = store.useCurrentSession();
  const contactsQuery = store.useContacts();
  const calmSettingsQuery = store.useCalmSettings();

  // links cached by older versions carry the old share domain. the
  // onboarding boot sequence never runs for signed-in updaters, so the
  // migration lives here, where every session mounts
  useEffect(() => {
    let cancelled = false;
    void db.personalInviteLink.getValue().then(async (cached) => {
      if (cancelled || !cached) {
        return;
      }
      const normalized = extractNormalizedInviteLink(cached);
      if (!normalized || normalized === cached) {
        return;
      }
      // re-read before writing: a logout wipe queued during the reads
      // must win — writing the old account's link back after the wipe
      // would hand it to the next account
      const current = await db.personalInviteLink.getValue();
      if (cancelled || current !== cached) {
        return;
      }
      void db.personalInviteLink.setValue(normalized);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contactsQuery.data}
      branchKey={BRANCH_KEY}
      branchDomain={BRANCH_DOMAIN}
      inviteServiceEndpoint={INVITE_SERVICE_ENDPOINT}
      inviteServiceIsDev={INVITE_SERVICE_IS_DEV}
      calmSettings={calmSettingsQuery.data}
      session={session}
      webAppNeedsUpdate={webAppNeedsUpdate}
      triggerWebAppUpdate={triggerWebAppUpdate}
      inviteSystemContacts={inviteSystemContacts}
    >
      {children}
    </AppDataContextProvider>
  );
}
