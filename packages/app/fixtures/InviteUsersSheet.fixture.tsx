import { AppDataContextProvider, InviteUsersSheet } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, initialContacts } from './fakeData';

function InviteUsersSheetFixture({
  contacts = initialContacts,
}: {
  contacts?: typeof initialContacts;
}) {
  return (
    <FixtureWrapper>
      <AppDataContextProvider currentUserId="~zod" contacts={contacts}>
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
  empty: <InviteUsersSheetFixture contacts={[]} />,
};
