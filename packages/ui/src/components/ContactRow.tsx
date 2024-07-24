import * as db from '@tloncorp/shared/dist/db';
import React, { useCallback, useMemo } from 'react';
import { ListItemProps } from 'tamagui';

import { Stack, View, XStack } from '../core';
import { getDisplayName, triggerHaptic } from '../utils';
import { Icon } from './Icon';
import { ListItem } from './ListItem';

function ContactRowItemRaw({
  contact,
  selected = false,
  selectable = false,
  onPress,
  ...rest
}: {
  contact: db.Contact;
  onPress: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
} & Omit<ListItemProps, 'onPress'>) {
  const displayName = useMemo(() => getDisplayName(contact), [contact]);

  const handlePress = useCallback(
    (id: string) => () => {
      onPress(id);
      if (!selectable || !selected) {
        triggerHaptic('baseButtonClick');
      }
    },
    [onPress, selectable, selected]
  );

  return (
    <ListItem onPress={handlePress(contact.id)} {...rest}>
      <ListItem.ContactIcon contactId={contact.id} />
      <ListItem.MainContent>
        <XStack alignItems="center">
          <ListItem.Title marginLeft="$l">{displayName}</ListItem.Title>
        </XStack>
      </ListItem.MainContent>
      {selectable && (
        <ListItem.EndContent>
          <Stack
            justifyContent="center"
            alignItems="center"
            height="$4xl"
            width="$4xl"
          >
            {selected ? (
              <Icon type="Checkmark" size="$xl" />
            ) : (
              <View
                borderWidth={1}
                borderRadius="$4xl"
                borderColor="$tertiaryText"
                opacity={0.6}
                height="$3xl"
                width="$3xl"
              />
            )}
          </Stack>
        </ListItem.EndContent>
      )}
    </ListItem>
  );
}
export const ContactRow = React.memo(ContactRowItemRaw);
