import * as db from '@tloncorp/shared/dist/db';

import { Badge } from './Badge';
import { ContactList } from './ContactList';

export function BlockedContactsWidget({
  blockedContacts,
  onBlockedContactPress,
}: {
  blockedContacts: db.Contact[];
  onBlockedContactPress: (contact: db.Contact) => void;
}) {
  return (
    <ContactList borderWidth={0}>
      {blockedContacts.map((contact) => (
        <ContactList.Item
          key={contact.id}
          contact={contact}
          onPress={() => onBlockedContactPress(contact)}
          showNickname
          showEndContent
          endContent={<Badge text="Unblock" type="neutral" />}
        />
      ))}
    </ContactList>
  );
}
