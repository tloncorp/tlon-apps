import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { Image, View, ViewProps, isWeb } from '../core';
import UrbitSigil from './UrbitSigil';

export function Avatar({
  contact,
  contactId,
  ...props
}: {
  contact?: db.Contact | null;
  contactId: string;
} & ViewProps) {
  // Note, the web Avatar component additionally checks calm settings and confirms the link is valid.
  if (contact?.avatarImage) {
    return (
      <View
        height={'$2xl'}
        width={'$2xl'}
        borderRadius="$2xs"
        overflow="hidden"
        {...props}
      >
        <Image
          source={{
            uri: contact.avatarImage,
          }}
          height="100%"
          width="100%"
        />
      </View>
    );
  }

  return (
    <UrbitSigil
      color={contact?.color ?? undefined}
      ship={contactId}
      {...props}
    />
  );
}
