import type * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { AnimatePresence, Spinner, View, XStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { useConversationComputingState } from './useConversationComputingState';

const MAX_VISIBLE_AVATARS = 3;

export function ThinkingState({
  conversationId,
  channelType,
}: {
  conversationId: string;
  channelType: db.Channel['type'];
}) {
  const computingState = useConversationComputingState(conversationId);

  if (!computingState) {
    return null;
  }

  const showAvatars = channelType !== 'dm' || computingState.ships.length >= 2;
  const visibleShips = computingState.ships.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = computingState.ships.length - visibleShips.length;

  return (
    <View paddingHorizontal="$l" paddingTop="$xs" paddingBottom="$s">
      <XStack alignItems="center" gap="$s">
        {showAvatars && (
          <XStack alignItems="center">
            <AnimatePresence>
              {visibleShips.map((shipState, index) => (
                <View
                  key={shipState.ship}
                  transition="quick"
                  scale={1}
                  opacity={1}
                  enterStyle={{ scale: 0.5, opacity: 0 }}
                  exitStyle={{ scale: 0.5, opacity: 0 }}
                  marginLeft={index === 0 ? 0 : -6}
                  zIndex={visibleShips.length - index}
                >
                  <ContactAvatar contactId={shipState.ship} size="$xl" />
                </View>
              ))}
            </AnimatePresence>
            {overflowCount > 0 && (
              <Text size="$label/s" color="$tertiaryText" marginLeft="$xs">
                +{overflowCount}
              </Text>
            )}
          </XStack>
        )}
        <Spinner size="small" color="$tertiaryText" />
        <Text size="$label/m" color="$tertiaryText" flexShrink={1}>
          {computingState.label}
        </Text>
      </XStack>
    </View>
  );
}
