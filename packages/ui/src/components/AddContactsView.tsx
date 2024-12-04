import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { Button } from './Button';
import { ContactBook } from './ContactBook';
import { ScreenHeader } from './ScreenHeader';

export function AddContactsView(props: {
  goBack: () => void;
  addContacts: (ids: string[]) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [newContacts, setNewContacts] = useState<string[]>([]);
  const handleAddContacts = useCallback(() => {
    props.addContacts(newContacts);
    props.goBack();
  }, [newContacts, props]);

  const { data: existingContacts } = store.useUserContacts();
  const existingIds = useMemo(() => {
    return existingContacts?.map((c) => c.id) ?? [];
  }, [existingContacts]);

  console.log(`existingIds`, existingIds);

  return (
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title="Add Contacts"
        backAction={props.goBack}
        showSessionStatus={false}
      />
      <YStack flex={1} paddingBottom={bottom} paddingHorizontal="$2xl">
        <ContactBook
          multiSelect
          searchable
          searchPlaceholder="Filter by nickname, @p"
          onSelectedChange={setNewContacts}
          immutableIds={existingIds}
        />

        <Button
          marginTop="$m"
          hero
          onPress={handleAddContacts}
          disabled={newContacts.length === 0}
        >
          <Button.Text>
            {newContacts.length === 0
              ? 'Add contact'
              : `Add ${newContacts.length} contact${newContacts.length > 1 ? 's' : ''}`}
          </Button.Text>
        </Button>
      </YStack>
    </View>
  );
}
