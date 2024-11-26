import * as store from '@tloncorp/shared/store';
import { AppDataContextProvider } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';

import {
  BRANCH_DOMAIN,
  BRANCH_KEY,
  INVITE_SERVICE_ENDPOINT,
  INVITE_SERVICE_IS_DEV,
} from '../constants';
import { useCurrentUserId } from '../hooks/useCurrentUser';

export function AppDataProvider({
  webAppNeedsUpdate,
  triggerWebAppUpdate,
  children,
}: PropsWithChildren<{
  webAppNeedsUpdate?: boolean;
  triggerWebAppUpdate?: (returnToRoot?: boolean) => Promise<void>;
}>) {
  const currentUserId = useCurrentUserId();
  const session = store.useCurrentSession();
  const contactsQuery = store.useContacts();
  const calmSettingsQuery = store.useCalmSettings({ userId: currentUserId });
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
    >
      {children}
    </AppDataContextProvider>
  );
}
