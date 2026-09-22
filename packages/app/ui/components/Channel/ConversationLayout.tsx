import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  KeyboardController,
  useKeyboardHandler,
  type NativeEvent,
} from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

const DockedConversationContext = createContext(false);

export function useIsConversationDocked() {
  return useContext(DockedConversationContext);
}

/** The list and composer share the available space above the keyboard. */
export function ConversationLayout({
  children,
  enabled,
  bottomInset,
}: PropsWithChildren<{ enabled: boolean; bottomInset?: number }>) {
  const docked = enabled && Platform.OS !== 'web';

  return (
    <DockedConversationContext.Provider value={docked}>
      {docked ? (
        <KeyboardResizingConversation>{children}</KeyboardResizingConversation>
      ) : (
        <YStack flex={1} minWidth={0} paddingBottom={bottomInset}>
          {children}
        </YStack>
      )}
    </DockedConversationContext.Provider>
  );
}

function KeyboardResizingConversation({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const isVisible = KeyboardController.isVisible();
  const height = useSharedValue(
    isVisible ? KeyboardController.state().height : 0
  );
  const progress = useSharedValue(isVisible ? 1 : 0);
  const update = (event: NativeEvent) => {
    'worklet';
    height.value = event.height;
    progress.value = event.progress;
  };
  useKeyboardHandler(
    { onMove: update, onInteractive: update, onEnd: update },
    []
  );
  const keyboardStyle = useAnimatedStyle(() => ({
    // Conversation screens reach the window bottom. The composer already owns
    // the safe area; reserve only the remaining keyboard overlap here.
    paddingBottom: Math.max(0, height.value - progress.value * insets.bottom),
  }));

  return (
    <Animated.View style={[styles.container, keyboardStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0 },
});
