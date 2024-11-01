import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { FlatList } from 'react-native-gesture-handler';

import { useSortedContacts } from '../hooks/contactSorters';
import { Badge } from './Badge';
import { ContactListItem } from './ListItem';

interface Props {
  contacts: db.Contact[];
  suggestions: db.Contact[];
  onContactPress: (contact: db.Contact) => void;
  onContactLongPress: (contact: db.Contact) => void;
}

export function ContactsScreenView(props: Props) {
  const trimmedSuggested = useMemo(() => {
    if (props.suggestions.length < 4 || props.contacts.length === 0) {
      return props.suggestions;
    }
    return props.suggestions.slice(0, 4);
  }, [props.contacts, props.suggestions]);

  const sortedContacts = useSortedContacts({
    contacts: props.contacts,
    query: '',
  });

  const realAndSuggested = useMemo(
    () => [...trimmedSuggested, ...sortedContacts],
    [sortedContacts, trimmedSuggested]
  );

  const renderItem = useCallback(
    ({ item }: { item: db.Contact }) => {
      return (
        <ContactListItem
          size="$4xl"
          contactId={item.id}
          showNickname
          showEndContent
          endContent={
            item.isContactSuggestion ? (
              <Badge text="Suggested" type="positive" />
            ) : null
          }
          onPress={() => props.onContactPress(item)}
          onLongPress={() => props.onContactLongPress(item)}
        />
      );
    },
    [props]
  );

  return <FlatList data={realAndSuggested} renderItem={renderItem} />;
}
