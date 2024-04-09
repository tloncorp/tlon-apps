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
  // TODO: is there a better way to do this? Could we modify usage in web to match native?
  // on native, we have to pass height/width for the source prop, on web we want to use other attributes
  // to set those
  const nativeDims = useMemo(
    () =>
      isWeb
        ? { height: undefined, width: undefined }
        : { height: 20, width: 20 },
    [isWeb]
  );

  // Note, the web Avatar component additionally checks calm settings and confirms the link is valid.
  if (contact?.avatarImage) {
    return (
      <View
        height={20}
        width={20}
        borderRadius="$2xs"
        overflow="hidden"
        {...props}
      >
        <Image
          source={{
            uri: contact.avatarImage,
            height: nativeDims.height,
            width: nativeDims.width,
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
