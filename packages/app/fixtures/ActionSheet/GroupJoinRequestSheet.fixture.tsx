import { AppDataContextProvider } from '../../ui';
import { GroupJoinRequestSheet } from '../../ui/components/GroupJoinRequestSheet';
import { brianContact } from '../fakeData';

export default {
  contact: (
    <AppDataContextProvider contacts={[brianContact]}>
      <GroupJoinRequestSheet
        contact={brianContact}
        contactId={brianContact.id}
        currentUserIsAdmin={true}
        open={true}
        onOpenChange={() => {}}
        onPressAccept={() => {}}
        onPressReject={() => {}}
        onPressGoToProfile={() => {}}
      />
    </AppDataContextProvider>
  ),
  noContact: (
    <AppDataContextProvider contacts={[]}>
      <GroupJoinRequestSheet
        contactId={brianContact.id}
        currentUserIsAdmin={true}
        open={true}
        onOpenChange={() => {}}
        onPressAccept={() => {}}
        onPressReject={() => {}}
        onPressGoToProfile={() => {}}
      />
    </AppDataContextProvider>
  ),
};
