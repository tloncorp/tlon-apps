import { AppDataContextProvider, ProfileSheet } from '../ui';

import { brianContact } from './fakeData';

export default {
  basic: (
    <AppDataContextProvider contacts={[brianContact]}>
      <ProfileSheet
        open
        onOpenChange={() => {}}
        contact={brianContact}
        contactId={brianContact.id}
      />
    </AppDataContextProvider>
  ),
};
