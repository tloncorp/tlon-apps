import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { XStack, YStack } from 'tamagui';

import { ContactAvatar } from './Avatar';

export default function ProfileRow({
  contactId,
  contact,
  dark,
}: {
  contactId: string;
  contact?: db.Contact;
  dark?: boolean;
  debugMessage?: string;
}) {
  const color = dark ? '$primaryText' : '$white';

  return (
    <XStack
      padding="$l"
      gap="$xl"
      alignItems="center"
      backgroundColor={dark ? '$secondaryBackground' : undefined}
      borderRadius={dark ? '$xl' : undefined}
    >
      <ContactAvatar size="$5xl" borderRadius={'$xl'} contactId={contactId} />
      <YStack flex={1} gap="$l" justifyContent="center">
        {contact?.nickname ? (
          <>
            <Text color={color} size="$label/2xl">
              {contact.nickname}
            </Text>
            <Text color={color} opacity={dark ? 0.5 : 0.7} size="$label/xl">
              {contact.id}
            </Text>
          </>
        ) : (
          <Text color={color} size="$label/3xl">
            {contactId}
          </Text>
        )}
      </YStack>
    </XStack>
  );
}
