import * as db from '@tloncorp/shared/db';
import React, { useCallback, useMemo } from 'react';
import { ListItemProps } from 'tamagui';
import { Stack, View, XStack } from 'tamagui';

import { getDisplayName, triggerHaptic } from '../utils';
import { Icon } from './Icon';
import { ListItem } from './ListItem';
import Pressable from './Pressable';

function ContactRowItemRaw({
  contact,
  selected = false,
  selectable = false,
  onPress,
  pressStyle,
  backgroundColor,
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
    <Pressable
      backgroundColor={backgroundColor}
      pressStyle={pressStyle}
      borderRadius="$xl"
      onPress={handlePress(contact.id)}
    >
      <ListItem {...rest}>
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
    </Pressable>
  );
}
export const ContactRow = React.memo(ContactRowItemRaw);
