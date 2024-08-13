import { AppDataContextProvider, ProfileSheet } from '@tloncorp/ui';

import { brianContact } from '../fakeData';

const ProfileSheetFixture = ({
  admin,
  groupIsOpen,
  userIsBanned,
}: {
  admin: boolean;
  groupIsOpen: boolean;
  userIsBanned: boolean;
}) => {
  return (
    <ProfileSheet
      open={true}
      onOpenChange={() => {}}
      contact={brianContact}
      contactId={brianContact.id}
      currentUserIsAdmin={admin}
      groupIsOpen={groupIsOpen}
      userIsBanned={userIsBanned}
      onPressBan={() => {}}
      onPressKick={() => {}}
      onPressUnban={() => {}}
    />
  );
};

export default {
  genericProfileSheet: (
    <AppDataContextProvider contacts={[brianContact]}>
      <ProfileSheetFixture
        admin={false}
        groupIsOpen={true}
        userIsBanned={false}
      />
    </AppDataContextProvider>
  ),
  groupMemberProfileSheetForAdmin: (
    <AppDataContextProvider contacts={[brianContact]}>
      <ProfileSheetFixture
        admin={true}
        groupIsOpen={true}
        userIsBanned={false}
      />
    </AppDataContextProvider>
  ),
  noContact: (
    <AppDataContextProvider contacts={[]}>
      <ProfileSheetFixture
        admin={true}
        groupIsOpen={true}
        userIsBanned={false}
      />
    </AppDataContextProvider>
  ),
};
