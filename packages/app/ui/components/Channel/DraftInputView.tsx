import { DraftInputId } from '@tloncorp/api';
import { ComponentProps, PropsWithChildren } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'tamagui';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import {
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
  onFloatingHeightChange,
  contentProps,
  inlineID,
}: PropsWithChildren<{
  enabled: boolean;
  onFloatingHeightChange?: (height: number) => void;
  contentProps?: ComponentProps<typeof View>;
  inlineID?: string;
}>) {
  const insets = useSafeAreaInsets();
  const scrollViewNativeID = useConversationScrollViewNativeID();
  const scrollToBottomControl = useConversationScrollToBottomControl();
  const content = contentProps ? (
    <View {...contentProps}>{children}</View>
  ) : (
    children
  );

  if (enabled && supportsFloatingComposer) {
    return (
      <KeyboardStickyView
        // The container keeps its home-indicator padding while the keyboard is
        // open, so cancel that padding to place the visible input at its edge.
        offset={{ closed: 0, opened: insets.bottom }}
        style={styles.floatingInput}
      >
        <ScrollEdgeElementContainer
          edge="bottom"
          scrollViewNativeID={scrollViewNativeID}
          style={{ paddingBottom: insets.bottom }}
          onLayout={(event) => {
            const scrollControlClearance =
              Platform.OS === 'ios' && scrollToBottomControl?.visible
                ? floatingScrollControlClearance
                : 0;
            onFloatingHeightChange?.(
              Math.max(
                0,
                event.nativeEvent.layout.height - scrollControlClearance
              )
            );
          }}
        >
          {content}
        </ScrollEdgeElementContainer>
      </KeyboardStickyView>
    );
  }

  if (contentProps || inlineID) {
    return (
      <View id={inlineID} {...contentProps}>
        {children}
      </View>
    );
  }

  return <>{children}</>;
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
