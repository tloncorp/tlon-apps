import { Button, Icon, Text } from '@tloncorp/ui';
import { XStack } from 'tamagui';

export function PostErrorMessage({
  message,
  testID,
  actionLabel,
  onAction,
  actionTestID,
}: {
  message: string;
  testID?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
}) {
  return (
    <XStack
      gap="$s"
      paddingVertical="$xl"
      justifyContent={'center'}
      alignItems={'center'}
      flex={1}
      testID={testID}
    >
      <Icon size="$s" type="Placeholder" color="$tertiaryText" />
      <Text size="$label/m" color="$tertiaryText">
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button
          onPress={onAction}
          size="$s"
          backgroundColor="transparent"
          borderWidth={0}
          padding="$xs"
          testID={actionTestID}
        >
          <Text
            size="$label/m"
            textDecorationLine="underline"
            textDecorationDistance={10}
            color="$primaryText"
          >
            {actionLabel}
          </Text>
        </Button>
      )}
    </XStack>
  );
}
