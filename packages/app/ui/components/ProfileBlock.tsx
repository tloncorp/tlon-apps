import * as db from '@tloncorp/shared/db';
import { ComponentProps } from 'react';
import { YStack } from 'tamagui';

import { useContactSafe } from '../contexts/appDataContext';
import { Pressable } from '../utils';
import ProfileCover from './ProfileCover';
import ProfileRow from './ProfileRow';

export const ProfileBlock = ({
  contactId,
  contact: contactProp,
  onPressGoToProfile,
  ...props
}: {
  contactId: string;
  contact?: db.Contact | null;
  onPressGoToProfile?: () => void;
} & Omit<ComponentProps<typeof ProfileCover>, 'uri'>) => {
  const contactFromContext = useContactSafe(contactId);
  const contact = contactProp ?? contactFromContext;
  return (
    <Pressable
      onPress={() => {
        onPressGoToProfile?.();
      }}
    >
      {contact?.coverImage ? (
        <ProfileCover width={'100%'} uri={contact.coverImage} {...props}>
          <YStack flex={1} justifyContent="flex-end">
            <ProfileRow
              contactId={contactId}
              contact={contact}
              debugMessage="ProfileCard"
            />
          </YStack>
        </ProfileCover>
      ) : (
        <ProfileRow
          contactId={contactId}
          contact={contact ?? undefined}
          debugMessage="ProfileCard"
          dark
        />
      )}
    </Pressable>
  );
};
