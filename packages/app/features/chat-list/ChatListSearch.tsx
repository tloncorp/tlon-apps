import { TextInput, interactionWithTiming } from '../../ui';
import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { View, YStack, useTheme } from 'tamagui';

export const ChatListSearch = React.memo(function ChatListSearchComponent({
  isOpen,
  query,
  onQueryChange,
  onPressClear,
  onPressClose,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  isOpen: boolean;
  onPressClear: () => void;
  onPressClose: () => void;
}) {
  const theme = useTheme();
  const [contentHeight, setContentHeight] = useState(0);

  const openProgress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    if (isOpen) {
      openProgress.value = interactionWithTiming(1, {
        easing: Easing.inOut(Easing.quad),
        duration: 200,
      });
    } else {
      openProgress.value = interactionWithTiming(0, {
        easing: Easing.inOut(Easing.quad),
        duration: 200,
      });
    }
  }, [isOpen, openProgress]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      overflow: 'hidden',
      height: contentHeight * openProgress.value,
      opacity: openProgress.value,
    };
  }, [openProgress, contentHeight]);

  const handleContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(e.nativeEvent.layout.height);
  }, []);

  return (
    <Animated.View style={containerStyle}>
      <YStack
        onLayout={handleContentLayout}
        flexShrink={0}
        backgroundColor={theme.background.val}
        gap="$m"
        position="absolute"
        top={0}
        left={0}
        right={0}
      >
        <View paddingHorizontal="$l" paddingTop="$xl">
          <TextInput
            icon="Search"
            placeholder="Find by name"
            value={query}
            onChangeText={onQueryChange}
            spellCheck={false}
            autoCorrect={false}
            autoCapitalize="none"
            rightControls={
              <TextInput.InnerButton
                label={query !== '' ? 'Clear' : 'Close'}
                onPress={query !== '' ? onPressClear : onPressClose}
              />
            }
          />
        </View>
      </YStack>
    </Animated.View>
  );
});
