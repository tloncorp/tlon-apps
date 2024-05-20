import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';
import React from 'react';
import { ListItemProps } from 'tamagui';

import { Stack, View, XStack, YStack } from '../core';
import { Avatar } from './Avatar';
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
  onPress: () => void;
  selectable?: boolean;
  selected?: boolean;
} & ListItemProps) {
  const displayName = useMemo(
    () =>
      contact.nickname && contact.nickname.length > 2
        ? contact.nickname
        : contact.id,
    [contact]
  );

  return (
    <ListItem onPress={onPress} {...rest}>
      <ListItem.Icon contactId={contact.id} contact={contact} />
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
