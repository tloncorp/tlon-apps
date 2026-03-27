import { Text } from '@tloncorp/ui';
import { Spinner, View, XStack, YStack } from 'tamagui';

import { Badge } from '../Badge';
import { useConversationComputingState } from './useConversationComputingState';

export function ThinkingState({
  conversationId,
}: {
  conversationId: string;
}) {
  const computingState = useConversationComputingState(conversationId);

  if (!computingState) {
    return null;
  }

  return (
    <View
      paddingHorizontal="$l"
      paddingVertical="$s"
      backgroundColor="$background"
      borderTopWidth={1}
      borderTopColor="$border"
    >
      <YStack gap="$s">
        <XStack alignItems="center" gap="$s">
          <Spinner size="small" color="$tertiaryText" />
          <Text size="$label/m" color="$tertiaryText" flexShrink={1}>
            {computingState.label}
          </Text>
        </XStack>
        {computingState.toolCalls.length > 0 && (
          <XStack flexWrap="wrap" gap="$xs">
            {computingState.toolCalls.map((toolCall) => (
              <Badge
                key={toolCall.toolName}
                text={toolCall.label}
                type="neutral"
                size="micro"
              />
            ))}
          </XStack>
        )}
      </YStack>
    </View>
  );
}
