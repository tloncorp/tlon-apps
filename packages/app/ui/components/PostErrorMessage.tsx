import { Button, ForwardingProps, Icon, Text, View } from '@tloncorp/ui';
import { useLayoutEffect, useState } from 'react';
import { XStack } from 'tamagui';

export function PostErrorMessage({
  message,
  actionLabel,
  onAction,
  actionTestID,
  forceNarrowLayout,
  style,
  ...restProps
}: ForwardingProps<
  typeof View,
  {
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    actionTestID?: string;
    forceNarrowLayout?: boolean;
  },
  'onLayout'
>) {
  const [isContainerNarrow, setIsContainerNarrow] = useState<boolean | null>(
    forceNarrowLayout ?? null
  );
  const [opacity, setOpacity] = useState(0);

  // Why `useLayoutEffect`?
  //
  // We want the following steps to occur serially:
  // 1. measure layout and set `isContainerNarrow`
  // 2. re-render using the correct responsive layout (flexDirection)
  // 3. set opacity to 1 once everything's correctly laid out
  // We use `useLayoutEffect` to set opacity (3) to ensure that step 2's render
  // synchronously completes before showing the content.
  useLayoutEffect(() => {
    setOpacity(isContainerNarrow == null ? 0 : 1);
  }, [isContainerNarrow]);

  return (
    <View
      gap="$s"
      paddingVertical="$xl"
      justifyContent={'center'}
      alignItems={'center'}
      onLayout={(event) => {
        if (forceNarrowLayout == null) {
          setIsContainerNarrow(event.nativeEvent.layout.width < 200);
        }
      }}
      flexDirection={isContainerNarrow ? 'column' : 'row'}
      style={[{ opacity }, style]}
      {...restProps}
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
