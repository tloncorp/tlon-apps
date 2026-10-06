import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

import { ContactAvatar } from './Avatar';
import { BotBadge } from './BotBadge';
import { ContactName } from './ContactNameV2';

export default function ProfileRow({
  contactId,
  contact,
  dark,
  compact = false,
  outlined = false,
  endContent,
}: {
  contactId: string;
  contact?: db.Contact;
  dark?: boolean;
  compact?: boolean;
  outlined?: boolean;
  endContent?: ReactNode;
  debugMessage?: string;
}) {
  const color = dark ? '$primaryText' : '$white';
  const hasNickname = contact?.nickname;

  return (
    <XStack
      padding="$l"
      gap={compact ? 14 : '$xl'}
      alignItems="center"
      backgroundColor={
        outlined ? '$background' : dark ? '$secondaryBackground' : undefined
      }
      borderColor={outlined ? '$border' : undefined}
      borderWidth={outlined ? 1 : 0}
      borderRadius={dark || outlined ? '$xl' : undefined}
    >
      <ContactAvatar
        size={compact ? 'custom' : '$5xl'}
        width={compact ? 52 : undefined}
        height={compact ? 52 : undefined}
        borderRadius={compact ? '$m' : '$xl'}
        contactId={contactId}
      />
      <YStack
        flex={1}
        minWidth={0}
        gap={compact ? '$xs' : '$l'}
        justifyContent="center"
      >
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
      {endContent}
    </XStack>
  );
}
