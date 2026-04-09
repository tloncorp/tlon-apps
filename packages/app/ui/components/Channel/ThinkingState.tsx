import { Text } from '@tloncorp/ui';
import { Spinner, View, XStack } from 'tamagui';

import { useConversationComputingState } from './useConversationComputingState';

export function ThinkingState({ conversationId }: { conversationId: string }) {
  const computingState = useConversationComputingState(conversationId);

  if (!computingState) {
    return null;
  }

  return (
    <View paddingHorizontal="$l" paddingTop="$xs" paddingBottom="$s">
      <XStack alignItems="center" gap="$s">
        <Spinner size="small" color="$tertiaryText" />
        <Text size="$label/m" color="$tertiaryText" flexShrink={1}>
          {computingState.label}
        </Text>
      </XStack>
    </View>
  );
}
