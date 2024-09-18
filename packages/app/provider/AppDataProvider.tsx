import * as store from '@tloncorp/shared/dist/store';
import { AppDataContextProvider } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';

import { BRANCH_DOMAIN, BRANCH_KEY } from '../constants';
import { useCurrentUserId } from '../hooks/useCurrentUser';

export function AppDataProvider({ children }: PropsWithChildren) {
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
      calmSettings={calmSettingsQuery.data}
      session={session}
    >
      {children}
    </AppDataContextProvider>
  );
}
