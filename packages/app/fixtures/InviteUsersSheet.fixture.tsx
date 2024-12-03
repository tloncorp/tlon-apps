import { AppDataContextProvider, InviteUsersSheet } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { group, initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper>
      <AppDataContextProvider currentUserId="~zod" contacts={initialContacts}>
        <InviteUsersSheet
          open
          onOpenChange={() => {}}
          onInviteComplete={() => {}}
          group={group}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
