import * as db from '@tloncorp/shared/db';
import React, { useCallback, useMemo } from 'react';
import { ListItemProps } from 'tamagui';
import { Stack, View, XStack } from 'tamagui';

import { getDisplayName, triggerHaptic } from '../utils';
import { Icon } from '@tloncorp/ui';
import { ListItem } from './ListItem';
import { Pressable } from '@tloncorp/ui';

function ContactRowItemRaw({
  contact,
  selected = false,
  selectable = false,
  immutable = false,
  onPress,
  pressStyle,
  backgroundColor,
  ...rest
}: {
  contact: db.Contact;
  onPress: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  immutable?: boolean;
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
          <ListItem.Title>{displayName}</ListItem.Title>
          {contact?.nickname && (
            <ListItem.Subtitle>{contact.id}</ListItem.Subtitle>
          )}
        </ListItem.MainContent>
        {selectable && (
          <ListItem.EndContent>
            <Stack
              justifyContent="center"
              alignItems="center"
              height="$4xl"
              width="$4xl"
            >
              {selected || immutable ? (
                <Icon
                  type="Checkmark"
                  size="$xl"
                  color={immutable ? '$blue' : undefined}
                />
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
