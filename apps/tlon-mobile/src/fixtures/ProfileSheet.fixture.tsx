import { ProfileSheet } from '@tloncorp/ui';

import { initialContacts } from './fakeData';

export default {
  basic: (
    <ProfileSheet
      open
      onOpenChange={() => {}}
      contact={initialContacts[0]}
      contactId={initialContacts[0].id}
    />
  ),
};
