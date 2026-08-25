import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { XStack, YStack } from 'tamagui';

import { ContactAvatar } from './Avatar';
import { BotBadge } from './BotBadge';
import { ContactName } from './ContactNameV2';

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
  const hasNickname = contact?.nickname;

  return (
    <XStack
      padding="$l"
      gap="$xl"
      alignItems="center"
      backgroundColor={dark ? '$secondaryBackground' : undefined}
      borderRadius={dark ? '$xl' : undefined}
    >
      <ContactAvatar size="$5xl" borderRadius={'$xl'} contactId={contactId} />
      <YStack flex={1} minWidth={0} gap="$l" justifyContent="center">
        {hasNickname ? (
          <>
            <XStack alignItems="center" gap="$s">
              <Text
                color={color}
                size="$label/2xl"
                numberOfLines={1}
                flex={1}
                minWidth={0}
              >
                <ContactName contactId={contactId} mode="nickname" />
              </Text>
              <BotBadge contactId={contactId} />
            </XStack>
            <Text color={color} opacity={dark ? 0.5 : 0.7} size="$label/xl">
              <ContactName
                contactId={contactId}
                mode="contactId"
                expandLongIds
              />
            </Text>
          </>
        ) : (
          <XStack alignItems="center" gap="$s">
            <Text
              color={color}
              size="$label/3xl"
              numberOfLines={1}
              flex={1}
              minWidth={0}
            >
              <ContactName
                contactId={contactId}
                mode="contactId"
                expandLongIds
              />
            </Text>
            <BotBadge contactId={contactId} />
          </XStack>
        )}
      </YStack>
    </XStack>
  );
}
