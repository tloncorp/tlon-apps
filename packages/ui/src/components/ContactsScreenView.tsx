import * as db from '@tloncorp/shared/db';
import { ScrollView, YStack } from 'tamagui';

import { ContactListItem } from './ListItem';

interface Props {
  contacts: db.Contact[];
  suggestions: db.Contact[];
}

export function ContactsScreenView(props: Props) {
  return (
    <ScrollView>
      {props.suggestions.map((contact) => (
        <ContactListItem key={contact.id} contactId={contact.id} />
      ))}
      {props.contacts.map((contact) => (
        <ContactListItem key={contact.id} contactId={contact.id} />
      ))}
    </ScrollView>
  );
}
