import * as store from '@tloncorp/shared/store';
import { Button, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { ContactBook } from './ContactBook';
import { ScreenHeader } from './ScreenHeader';

export function AddContactsView(props: {
  goBack: () => void;
  addContacts: (ids: string[]) => void;
}) {
  const { bottom, top } = useSafeAreaInsets();
  const [newContacts, setNewContacts] = useState<string[]>([]);
  const handleAddContacts = useCallback(() => {
    props.addContacts(newContacts);
    props.goBack();
  }, [newContacts, props]);

  const isWindowNarrow = useIsWindowNarrow();
  const { data: existingContacts } = store.useUserContacts();
  const existingIds = useMemo(() => {
    return existingContacts?.map((c) => c.id) ?? [];
  }, [existingContacts]);

  return (
    <View backgroundColor="$background" flex={1}>
      <ScreenHeader
        title="Add Contacts"
        backAction={isWindowNarrow ? () => props.goBack() : undefined}
        showSessionStatus={false}
        borderBottom
        useHorizontalTitleLayout={!isWindowNarrow}
        rightControls={
          !isWindowNarrow ? (
            <ScreenHeader.TextButton onPress={() => props.goBack()}>
              Cancel
            </ScreenHeader.TextButton>
          ) : null
        }
      />
      <YStack
        flex={1}
        paddingTop={top + 20}
        paddingBottom={bottom + 20}
        paddingHorizontal="$2xl"
        marginHorizontal="auto"
        width="100%"
        maxWidth={600}
      >
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
