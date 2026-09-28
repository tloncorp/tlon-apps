import { DraftInputId } from '@tloncorp/api';
import { ComponentProps, PropsWithChildren, useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  KeyboardController,
  KeyboardStickyView,
  type NativeEvent,
  useKeyboardHandler,
} from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, getVariableValue, useTheme } from 'tamagui';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import {
  useConversationComposerHeight,
  useConversationScrollToBottomControl,
  useConversationScrollViewNativeID,
} from '../../contexts/scroll';
import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';
import {
  floatingScrollControlClearance,
  unobscuredConversationBottomGap,
} from '../conversationScrollChrome';
import { DraftInputContext } from '../draftInputs';
import { DraftInputContextProvider } from '../draftInputs/shared';

export function DraftInputView({
  draftInputContext,
  type,
  bottomChromeClearance,
  onFloatingHeightChange,
}: {
  draftInputContext: DraftInputContext;
  type: DraftInputId;
  bottomChromeClearance?: number;
  onFloatingHeightChange?: (height: number) => void;
}) {
  const { inputs } = useComponentsKitContext();
  const InputComponent = inputs[type];

  if (InputComponent) {
    const input = (
      <DraftInputContextProvider value={draftInputContext}>
        <InputComponent draftInputContext={draftInputContext} />
      </DraftInputContextProvider>
    );

    return (
      <ConversationComposerPlacement
        enabled={type === DraftInputId.chat}
        bottomChromeClearance={bottomChromeClearance}
        onFloatingHeightChange={onFloatingHeightChange}
      >
        {input}
      </ConversationComposerPlacement>
    );
  }
}

const supportsFloatingComposer = Platform.OS !== 'web';

// KC's iOS sticky view applies its final position in onStart. Use native frame
// events instead so the composer does not jump ahead of the keyboard.
function IOSKeyboardTrackingView({
  style,
  offset,
  enabled = true,
  ...props
}: ComponentProps<typeof KeyboardStickyView>) {
  const isVisible = KeyboardController.isVisible();
  const height = useSharedValue(
    isVisible ? KeyboardController.state().height : 0
  );
  const progress = useSharedValue(isVisible ? 1 : 0);
  const closedOffset = offset?.closed ?? 0;
  const openedOffset = offset?.opened ?? 0;
  const update = (event: NativeEvent) => {
    'worklet';
    height.value = event.height;
    progress.value = event.progress;
  };
  useKeyboardHandler(
    { onMove: update, onInteractive: update, onEnd: update },
    []
  );
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: enabled
          ? -height.value +
            closedOffset +
            progress.value * (openedOffset - closedOffset)
          : closedOffset,
      },
    ],
  }));
  return <Animated.View {...props} style={[style, animatedStyle]} />;
}

const ComposerKeyboardView =
  Platform.OS === 'ios' ? IOSKeyboardTrackingView : KeyboardStickyView;

/** Owns the native floating placement and its matching scroll-content inset. */
export function ConversationComposerPlacement({
  children,
  enabled,
  avoidKeyboard = false,
  bottomChromeClearance = 0,
  onFloatingHeightChange,
  contentProps,
  inlineID,
}: PropsWithChildren<{
  enabled: boolean;
  avoidKeyboard?: boolean;
  /**
   * Band occluded by chrome below the composer — the top-level tab bar. Its
   * band already covers the home indicator, so clear the larger of the two
   * rather than stacking them.
   */
  bottomChromeClearance?: number;
  onFloatingHeightChange?: (height: number) => void;
  contentProps?: ComponentProps<typeof View>;
  inlineID?: string;
}>) {
  const insets = useSafeAreaInsets();
  const composerBottomInset = bottomChromeClearance
    ? Math.max(
        insets.bottom,
        bottomChromeClearance + unobscuredConversationBottomGap
      )
    : insets.bottom;
  // Padding and the sticky view's offset have to agree, so both stay constant —
  // changing them on keyboard visibility jumps the composer mid-animation. The
  // sticky view cancels this padding to sit on the keyboard's edge, so that much
  // of the measured height stops occupying the list; the list interpolates it
  // away on keyboard progress instead.
  const collapsibleInset = composerBottomInset - insets.bottom;
  const theme = useTheme();
  const scrollViewNativeID = useConversationScrollViewNativeID();
  const scrollToBottomControl = useConversationScrollToBottomControl();
  const { report: reportConversationComposerHeight } =
    useConversationComposerHeight();
  const content = contentProps ? (
    <View {...contentProps}>{children}</View>
  ) : (
    children
  );

  useEffect(() => {
    if (!enabled || !supportsFloatingComposer) {
      return;
    }
    return () => reportConversationComposerHeight(0);
  }, [enabled, reportConversationComposerHeight]);

  if (enabled && supportsFloatingComposer) {
    return (
      <ComposerKeyboardView
        // The container keeps its home-indicator padding while the keyboard is
        // open, so cancel that padding to place the visible input at its edge.
        offset={{ closed: 0, opened: composerBottomInset }}
        style={styles.floatingInput}
      >
        <ScrollEdgeElementContainer
          edge="bottom"
          scrollViewNativeID={scrollViewNativeID}
          style={[
            { paddingBottom: composerBottomInset },
            Platform.OS === 'android'
              ? { backgroundColor: getVariableValue(theme.background) }
              : undefined,
          ]}
          onLayout={(event) => {
            const scrollControlClearance =
              Platform.OS === 'ios' && scrollToBottomControl?.visible
                ? floatingScrollControlClearance
                : 0;
            const height = Math.max(
              0,
              event.nativeEvent.layout.height - scrollControlClearance
            );
            // Feed the list's Reanimated content inset before publishing the
            // React geometry used by surrounding controls. The scroll view can
            // then adjust its inset and offset in one native commit.
            reportConversationComposerHeight(height, collapsibleInset);
            onFloatingHeightChange?.(height);
          }}
        >
          {content}
        </ScrollEdgeElementContainer>
      </ComposerKeyboardView>
    );
  }

  const inlineContent =
    contentProps || inlineID ? (
      <View id={inlineID} {...contentProps}>
        {children}
      </View>
    ) : (
      children
    );

  if (avoidKeyboard && Platform.OS !== 'web') {
    return (
      <ComposerKeyboardView offset={{ closed: 0, opened: insets.bottom }}>
        {inlineContent}
      </ComposerKeyboardView>
    );
  }

  return <>{inlineContent}</>;
}

const styles = StyleSheet.create({
  floatingInput: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
