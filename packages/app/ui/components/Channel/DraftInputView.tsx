import { DraftInputId } from '@tloncorp/api';
import { ComponentProps, PropsWithChildren, useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, getVariableValue, useTheme } from 'tamagui';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import {
  useConversationComposerHeight,
  useConversationScrollToBottomControl,
  useConversationScrollViewNativeID,
} from '../../contexts/scroll';
import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';
import { floatingScrollControlClearance } from '../conversationScrollChrome';
import { DraftInputContext } from '../draftInputs';
import { DraftInputContextProvider } from '../draftInputs/shared';

export function DraftInputView({
  draftInputContext,
  type,
  onFloatingHeightChange,
}: {
  draftInputContext: DraftInputContext;
  type: DraftInputId;
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
        onFloatingHeightChange={onFloatingHeightChange}
      >
        {input}
      </ConversationComposerPlacement>
    );
  }
}

const supportsFloatingComposer = Platform.OS !== 'web';

/** Owns the native floating placement and its matching scroll-content inset. */
export function ConversationComposerPlacement({
  children,
  enabled,
  avoidKeyboard = false,
  onFloatingHeightChange,
  contentProps,
  inlineID,
}: PropsWithChildren<{
  enabled: boolean;
  avoidKeyboard?: boolean;
  onFloatingHeightChange?: (height: number) => void;
  contentProps?: ComponentProps<typeof View>;
  inlineID?: string;
}>) {
  const insets = useSafeAreaInsets();
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
      <KeyboardStickyView
        enabled={Platform.OS === 'ios'}
        // The container keeps its home-indicator padding while the keyboard is
        // open, so cancel that padding to place the visible input at its edge.
        offset={{ closed: 0, opened: insets.bottom }}
        style={styles.floatingInput}
      >
        <ScrollEdgeElementContainer
          edge="bottom"
          scrollViewNativeID={scrollViewNativeID}
          style={[
            { paddingBottom: insets.bottom },
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
            reportConversationComposerHeight(height);
            onFloatingHeightChange?.(height);
          }}
        >
          {content}
        </ScrollEdgeElementContainer>
      </KeyboardStickyView>
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

  if (avoidKeyboard && Platform.OS === 'ios') {
    return (
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        {inlineContent}
      </KeyboardStickyView>
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
