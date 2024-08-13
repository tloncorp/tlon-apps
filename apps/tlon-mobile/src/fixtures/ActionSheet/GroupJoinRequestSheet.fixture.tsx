import { AppDataContextProvider } from '@tloncorp/ui';
import { GroupJoinRequestSheet } from '@tloncorp/ui/src/components/GroupJoinRequestSheet';

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
      />
    </AppDataContextProvider>
  ),
};
