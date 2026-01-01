import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import React, { useMemo } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';

export interface FacePileProps {
  contacts: db.Contact[];
  maxVisible?: number;
  grid?: boolean;
}

export const FacePile = React.memo(function FacePileComponent({
  contacts,
  maxVisible = 4,
  grid = false,
}: FacePileProps) {
  const effectiveMaxVisible = grid ? Math.min(maxVisible, 3) : maxVisible;
  const visibleContacts = useMemo(
    () => contacts.slice(0, effectiveMaxVisible),
    [contacts, effectiveMaxVisible]
  );
  const overflowCount = Math.max(0, contacts.length - effectiveMaxVisible);

  if (grid) {
    return (
      <YStack gap={2}>
        <XStack gap={2}>
          {visibleContacts.slice(0, 2).map((contact) => (
            <ContactAvatar
              key={contact.id}
              contactId={contact.id}
              contactOverride={contact}
              size="$xl"
            />
          ))}
        </XStack>
        <XStack gap={2}>
          {visibleContacts.slice(2, 3).map((contact) => (
            <ContactAvatar
              key={contact.id}
              contactId={contact.id}
              contactOverride={contact}
              size="$xl"
            />
          ))}
          {overflowCount > 0 && (
            <View
              width="$xl"
              height="$xl"
              borderRadius="$2xs"
              backgroundColor="$tertiaryBackground"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={10} color="$secondaryText">
                +{overflowCount}
              </Text>
            </View>
          )}
        </XStack>
      </YStack>
    );
  }

  return (
    <XStack alignItems="center">
      {visibleContacts.map((contact, index) => (
        <View
          key={contact.id}
          marginLeft={index === 0 ? 0 : -12}
          zIndex={visibleContacts.length + index}
        >
          <ContactAvatar
            contactId={contact.id}
            contactOverride={contact}
            size="$2xl"
          />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          marginLeft={-12}
          zIndex={7}
          width={24}
          height={24}
          borderRadius="$s"
          backgroundColor="$secondaryBackground"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="$xs" color="$primaryText">
            +{overflowCount}
          </Text>
        </View>
      )}
    </XStack>
  );
});
