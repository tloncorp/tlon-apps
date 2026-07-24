import { DraftInputId } from '@tloncorp/api';
import { View } from 'tamagui';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import { usesFloatingMessageInputChrome } from '../MessageInput/MessageInputChrome';
import { DraftInputContext } from '../draftInputs';
import { DraftInputContextProvider } from '../draftInputs/shared';

export function DraftInputView(props: {
  draftInputContext: DraftInputContext;
  type: DraftInputId;
}) {
  const { inputs } = useComponentsKitContext();
  const InputComponent = inputs[props.type];
  if (InputComponent) {
    const input = (
      <DraftInputContextProvider value={props.draftInputContext}>
        <InputComponent draftInputContext={props.draftInputContext} />
      </DraftInputContextProvider>
    );

    if (usesFloatingMessageInputChrome && props.type === DraftInputId.chat) {
      return (
        <View position="absolute" bottom={0} left={0} right={0} zIndex={10}>
          {input}
        </View>
      );
    }

    return input;
  }
}
