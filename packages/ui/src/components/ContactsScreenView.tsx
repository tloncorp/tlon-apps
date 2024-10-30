import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { ScrollView, YStack } from 'tamagui';

import { Badge } from './Badge';
import { ContactListItem } from './ListItem';

interface Props {
  contacts: db.Contact[];
  suggestions: db.Contact[];
  onContactPress: (contactId: string) => void;
}

export function ContactsScreenView(props: Props) {
  const realAndSuggested = useMemo(
    () => [...props.suggestions, ...props.contacts],
    [props.contacts, props.suggestions]
  );

  const renderItem = useCallback(({ item }: { item: db.Contact }) => {
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
        onPress={() => props.onContactPress(item.id)}
      />
    );
  }, []);

  return <FlatList data={realAndSuggested} renderItem={renderItem} />;
}
