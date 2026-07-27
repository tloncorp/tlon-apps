import { DraftInputId } from '@tloncorp/api';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import { usesFloatingMessageInputChrome } from '../MessageInput/MessageInputChrome';
import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';
import { DraftInputContext } from '../draftInputs';
import { DraftInputContextProvider } from '../draftInputs/shared';
import { conversationScrollViewNativeID } from '../nativeScrollEdgeEffects';

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
  const isFloatingChatInput =
    usesFloatingMessageInputChrome && type === DraftInputId.chat;

  useEffect(() => {
    if (!isFloatingChatInput) {
      onFloatingHeightChange?.(0);
    }

    return () => onFloatingHeightChange?.(0);
  }, [isFloatingChatInput, onFloatingHeightChange]);

  if (InputComponent) {
    const input = (
      <DraftInputContextProvider value={draftInputContext}>
        <InputComponent draftInputContext={draftInputContext} />
      </DraftInputContextProvider>
    );

    if (isFloatingChatInput) {
      return (
        <ScrollEdgeElementContainer
          edge="bottom"
          scrollViewNativeID={conversationScrollViewNativeID}
          style={styles.floatingInput}
          onLayout={(event) =>
            onFloatingHeightChange?.(event.nativeEvent.layout.height)
          }
        >
          {input}
        </ScrollEdgeElementContainer>
      );
    }

    return input;
  }
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
