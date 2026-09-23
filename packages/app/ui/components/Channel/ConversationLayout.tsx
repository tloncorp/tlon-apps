import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  KeyboardController,
  useKeyboardHandler,
  type NativeEvent,
} from 'react-native-keyboard-controller';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

const DockedConversationContext = createContext(false);
const ComposerLayoutContext = createContext({
  floating: false,
  height: 0,
  setFloating: (_floating: boolean) => {},
  setHeight: (_height: number) => {},
});

export function useConversationComposerLayout() {
  return useContext(ComposerLayoutContext);
}

const KeyboardLiftContext = createContext<SharedValue<number> | null>(null);

/** Moves chrome with the iOS keyboard; the list follows through its insets. */
export function useConversationKeyboardLiftStyle() {
  const lift = useContext(KeyboardLiftContext);
  const fallback = useSharedValue(0);
  const value = lift ?? fallback;
  return useAnimatedStyle(
    () => ({ transform: [{ translateY: -value.value }] }),
    [value]
  );
}

export function useIsConversationDocked() {
  // Layout ownership stays fixed even while its composer floats over history.
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
  const [floating, setFloating] = useState(false);
  const [composerHeight, setHeight] = useState(0);
  const composerLayout = useMemo(
    () => ({ floating, height: composerHeight, setFloating, setHeight }),
    [floating, composerHeight]
  );
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
  // Conversation screens reach the window bottom. The composer already owns
  // the safe area; only the remaining keyboard overlap needs clearance.
  const lift = useDerivedValue(() =>
    Math.max(0, height.value - progress.value * insets.bottom)
  );
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: resizesForKeyboard ? lift.value : 0,
  }));

  return (
    <Animated.View style={[styles.container, keyboardStyle]}>
      <KeyboardLiftContext.Provider value={resizesForKeyboard ? null : lift}>
        <ComposerLayoutContext.Provider value={composerLayout}>
          {/* Absolute composers use the keyboard-resized bounds, not the outer
              view's padding box. Keep this parent and both children mounted. */}
          <YStack flex={1} minHeight={0} minWidth={0}>
            {children}
          </YStack>
        </ComposerLayoutContext.Provider>
      </KeyboardLiftContext.Provider>
    </Animated.View>
  );
}

// Resizing re-lays out the whole conversation on every keyboard frame. iOS
// keeps the frame fixed: chrome translates and the list animates its insets.
const resizesForKeyboard = Platform.OS !== 'ios';

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0 },
});
