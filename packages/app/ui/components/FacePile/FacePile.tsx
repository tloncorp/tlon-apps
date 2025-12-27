import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import React, { useMemo } from 'react';
import { View, XStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';

export interface FacePileProps {
  contacts: db.Contact[];
  maxVisible?: number;
}

export const FacePile = React.memo(function FacePileComponent({
  contacts,
  maxVisible = 4,
}: FacePileProps) {
  const visibleContacts = useMemo(
    () => contacts.slice(0, maxVisible),
    [contacts, maxVisible]
  );
  const overflowCount = Math.max(0, contacts.length - maxVisible);

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
