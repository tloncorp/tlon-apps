import { Button, Icon, Text, View } from '@tloncorp/ui';
import { useLayoutEffect, useState } from 'react';
import 'react-native-reanimated';
import { XStack } from 'tamagui';

export function PostErrorMessage({
  message,
  testID,
  actionLabel,
  onAction,
  actionTestID,
  forceNarrowLayout,
}: {
  message: string;
  testID?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
  forceNarrowLayout?: boolean;
}) {
  const [isContainerNarrow, setIsContainerNarrow] = useState<boolean | null>(
    forceNarrowLayout ?? null
  );
  const [opacity, setOpacity] = useState(0);
  useLayoutEffect(() => {
    setOpacity(isContainerNarrow == null ? 0 : 1);
  }, [isContainerNarrow]);

  return (
    <View
      gap="$s"
      paddingVertical="$xl"
      justifyContent={'center'}
      alignItems={'center'}
      testID={testID}
      onLayout={(event) => {
        if (forceNarrowLayout == null) {
          setIsContainerNarrow(event.nativeEvent.layout.width < 200);
        }
      }}
      flexDirection={isContainerNarrow ? 'column' : 'row'}
      style={{ opacity }}
    >
      <XStack gap="$s">
        <Icon size="$s" type="Placeholder" color="$tertiaryText" />
        <Text size="$label/m" color="$tertiaryText">
          {message}
        </Text>
      </XStack>
      {actionLabel && onAction && (
        <Button.Frame
          onPress={onAction}
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
        </Button.Frame>
      )}
    </View>
  );
}
