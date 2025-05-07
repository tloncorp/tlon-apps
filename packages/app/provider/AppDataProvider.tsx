import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { PropsWithChildren } from 'react';

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
