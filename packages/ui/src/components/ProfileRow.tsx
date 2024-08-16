import * as db from '@tloncorp/shared/dist/db';
import { XStack, YStack } from 'tamagui';

import { ContactAvatar } from './Avatar';
import { LabelText } from './TrimmedText';

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
      <ContactAvatar
        size="custom"
        width={100}
        height={100}
        borderRadius={'$xl'}
        contactId={contactId}
      />
      <YStack flex={1} gap="$l" justifyContent="center">
        {contact?.nickname ? (
          <>
            <LabelText color={color} size="$2xl">
              {contact.nickname}
            </LabelText>
            <LabelText color={color} opacity={dark ? 0.5 : 0.7} size="$xl">
              {contact.id}
            </LabelText>
          </>
        ) : (
          <LabelText color={color} size="$3xl">
            {contactId}
          </LabelText>
        )}
      </YStack>
    </XStack>
  );
}
