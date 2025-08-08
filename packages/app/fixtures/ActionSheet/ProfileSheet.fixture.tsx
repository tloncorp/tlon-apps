import { AppDataContextProvider, ProfileSheet } from '../../ui';
import { brianContact } from '../fakeData';

const ProfileSheetFixture = ({
  admin,
  userIsBanned,
}: {
  admin: boolean;
  userIsBanned: boolean;
}) => {
  return (
    <ProfileSheet
      open={true}
      onOpenChange={() => {}}
      contact={brianContact}
      contactId={brianContact.id}
      currentUserIsAdmin={admin}
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
      <ProfileSheetFixture admin={false} userIsBanned={false} />
    </AppDataContextProvider>
  ),
  groupMemberProfileSheetForAdmin: (
    <AppDataContextProvider contacts={[brianContact]}>
      <ProfileSheetFixture admin={true} userIsBanned={false} />
    </AppDataContextProvider>
  ),
  noContact: (
    <AppDataContextProvider contacts={[]}>
      <ProfileSheetFixture admin={true} userIsBanned={false} />
    </AppDataContextProvider>
  ),
  privateGroupAdmin: (
    <AppDataContextProvider contacts={[brianContact]}>
      <ProfileSheetFixture admin={true} userIsBanned={false} />
    </AppDataContextProvider>
  ),
  secretGroupAdmin: (
    <AppDataContextProvider contacts={[brianContact]}>
      <ProfileSheetFixture admin={true} userIsBanned={false} />
    </AppDataContextProvider>
  ),
};
