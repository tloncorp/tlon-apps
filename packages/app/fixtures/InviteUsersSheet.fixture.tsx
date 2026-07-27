import { AppDataContextProvider, InviteUsersSheet } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, initialContacts } from './fakeData';

function InviteUsersSheetFixture() {
  return (
    <FixtureWrapper>
      <AppDataContextProvider currentUserId="~zod" contacts={initialContacts}>
        <InviteUsersSheet
          open
          onOpenChange={() => {}}
          onInviteComplete={() => {}}
          groupId={group.id}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  );
}

export default {
  basic: <InviteUsersSheetFixture />,
};
