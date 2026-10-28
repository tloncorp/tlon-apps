import { Pressable, Text } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Platform, Switch } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

export function PrivateChannelToggle({
  isPrivate,
  onTogglePrivate,
}: {
  isPrivate: boolean;
  onTogglePrivate: (value: boolean) => void;
}) {
  const handleToggle = useCallback(() => {
    onTogglePrivate(!isPrivate);
  }, [isPrivate, onTogglePrivate]);

  return (
    <XStack
      padding="$xl"
      justifyContent="space-between"
      alignItems="center"
      gap="$xl"
      backgroundColor="$secondaryBackground"
      width="100%"
      pointerEvents="auto"
    >
      <YStack gap="$xl" flex={1} pointerEvents="auto">
        <Text size="$label/l">Custom Permissions</Text>
        <Text size="$label/s" color="$tertiaryText">
          Only selected roles will be able to view or write to this channel.
        </Text>
      </YStack>
      {Platform.OS === 'android' ? (
        // Android-specific: Wrap Switch in Pressable to handle tap gestures before
        // they reach the Sheet's pan gesture handler. The Switch itself has
        // pointerEvents="none" to make it purely visual, while Pressable handles
        // all touch interaction. This fixes Switch tap detection issues in sheets
        // on physical Android devices.
        <Pressable
          onPress={handleToggle}
          testID="PrivateChannelTogglePressable"
        >
          <View pointerEvents="none">
            <Switch value={isPrivate} testID="PrivateChannelToggle" />
          </View>
        </Pressable>
      ) : (
        <Switch
          value={isPrivate}
          onValueChange={onTogglePrivate}
          testID="PrivateChannelToggle"
        />
      )}
    </XStack>
  );
}
