import { DraftInputId } from '@tloncorp/api';
import { ParentAgnosticKeyboardAvoidingView } from '@tloncorp/ui';
import { ComponentProps, PropsWithChildren } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'tamagui';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import {
  useConversationScrollToBottomControl,
  useConversationScrollViewNativeID,
} from '../../contexts/scroll';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
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

/** Keeps the conversation viewport above the iOS keyboard from any nav offset. */
export function ConversationKeyboardAvoidingView({
  children,
  enabled,
}: PropsWithChildren<{ enabled: boolean }>) {
  if (Platform.OS === 'ios' && enabled) {
    return (
      <ParentAgnosticKeyboardAvoidingView
        contentContainerStyle={styles.keyboardAvoidingContent}
      >
        {children}
      </ParentAgnosticKeyboardAvoidingView>
    );
  }

  return <View style={styles.keyboardAvoidingContent}>{children}</View>;
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
  const keyboardHeight = useKeyboardHeight();
  const scrollViewNativeID = useConversationScrollViewNativeID();
  const scrollToBottomControl = useConversationScrollToBottomControl();
  const content = contentProps ? (
    <View {...contentProps}>{children}</View>
  ) : (
    children
  );

  if (enabled && supportsFloatingComposer) {
    return (
      <ScrollEdgeElementContainer
        edge="bottom"
        scrollViewNativeID={scrollViewNativeID}
        style={[
          styles.floatingInput,
          { paddingBottom: keyboardHeight > 0 ? 0 : insets.bottom },
        ]}
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
  keyboardAvoidingContent: {
    flex: 1,
  },
  floatingInput: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
