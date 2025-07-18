import { ComponentProps } from 'react';
import { YStack } from 'tamagui';

import { useContact } from '../contexts/appDataContext';
import { Pressable } from '../utils';
import ProfileCover from './ProfileCover';
import ProfileRow from './ProfileRow';

export const ProfileBlock = ({
  contactId,
  onPressGoToProfile,
  ...props
}: {
  contactId: string;
  onPressGoToProfile?: () => void;
} & Omit<ComponentProps<typeof ProfileCover>, 'uri'>) => {
  const contact = useContact(contactId);
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
