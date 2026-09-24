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

import { unobscuredConversationBottomGap } from '../conversationInsets';

const DockedConversationContext = createContext(false);
const ConversationBottomInsetContext = createContext<number | null>(null);
const ComposerLayoutContext = createContext({
  floating: false,
  height: 0,
  setFloating: (_floating: boolean) => {},
  setHeight: (_height: number) => {},
});

export function useConversationComposerLayout() {
  return useContext(ComposerLayoutContext);
}

export function useConversationBottomInset(bottomChromeClearance = 0) {
  const inset = useContext(ConversationBottomInsetContext);
  const { bottom } = useSafeAreaInsets();
  return (
    inset ??
    (bottomChromeClearance
      ? Math.max(
          bottom,
          bottomChromeClearance + unobscuredConversationBottomGap
        )
      : bottom)
  );
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
  bottomChromeClearance,
}: PropsWithChildren<{
  enabled: boolean;
  bottomInset?: number;
  bottomChromeClearance?: number;
}>) {
  const docked = enabled && Platform.OS !== 'web';

  return (
    <DockedConversationContext.Provider value={docked}>
      {docked ? (
        <KeyboardResizingConversation
          bottomChromeClearance={bottomChromeClearance}
        >
          {children}
        </KeyboardResizingConversation>
      ) : (
        <YStack flex={1} minWidth={0} paddingBottom={bottomInset}>
          {children}
        </YStack>
      )}
    </DockedConversationContext.Provider>
  );
}

function KeyboardResizingConversation({
  children,
  bottomChromeClearance,
}: PropsWithChildren<{ bottomChromeClearance?: number }>) {
  const [floating, setFloating] = useState(false);
  const [composerHeight, setHeight] = useState(0);
  const composerLayout = useMemo(
    () => ({ floating, height: composerHeight, setFloating, setHeight }),
    [floating, composerHeight]
  );
  const bottomInset = useConversationBottomInset(bottomChromeClearance);
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
  // The composer already clears the home indicator or tab bar. The keyboard
  // covers that band, so only its remaining overlap needs additional clearance.
  const lift = useDerivedValue(() =>
    Math.max(0, height.value - progress.value * bottomInset)
  );
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: resizesForKeyboard ? lift.value : 0,
  }));

  return (
    <Animated.View style={[styles.container, keyboardStyle]}>
      <KeyboardLiftContext.Provider value={resizesForKeyboard ? null : lift}>
        <ConversationBottomInsetContext.Provider value={bottomInset}>
          <ComposerLayoutContext.Provider value={composerLayout}>
            {/* Absolute composers use the keyboard-resized bounds, not the outer
              view's padding box. Keep this parent and both children mounted. */}
            <YStack flex={1} minHeight={0} minWidth={0}>
              {children}
            </YStack>
          </ComposerLayoutContext.Provider>
        </ConversationBottomInsetContext.Provider>
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
