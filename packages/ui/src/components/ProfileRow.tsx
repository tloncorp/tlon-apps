import * as db from '@tloncorp/shared/dist/db';
import { View, XStack, YStack } from 'tamagui';

import { ContactAvatar } from './Avatar';
import ContactName from './ContactName';
import { DebugInfo } from './DebugInfo';

export default function ProfileRow({
  contactId,
  contact,
  dark,
  debugMessage,
}: {
  contactId: string;
  contact?: db.Contact;
  dark?: boolean;
  debugMessage?: string;
}) {
  const color = dark ? '$primaryText' : '$white';
  return (
    <XStack
      padding="$2xl"
      alignItems="center"
      backgroundColor={dark ? '$secondaryBackground' : undefined}
      borderRadius={dark ? '$xl' : undefined}
    >
      {debugMessage ? (
        <DebugInfo debugMessage={debugMessage}>
          <ContactAvatar size="$5xl" contactId={contactId} />
        </DebugInfo>
      ) : (
        <ContactAvatar size="$5xl" contactId={contactId} />
      )}
      <View marginLeft="$l" flex={1}>
        {contact?.nickname ? (
          <YStack>
            <ContactName
              color={color}
              fontWeight="$xl"
              userId={contactId}
              showNickname
            />
            <ContactName
              fontFamily="$mono"
              color={color}
              opacity={dark ? 0.5 : 0.7}
              userId={contactId}
            />
          </YStack>
        ) : (
          <ContactName color={color} fontWeight="$xl" userId={contactId} />
        )}
      </View>
    </XStack>
  );
}
