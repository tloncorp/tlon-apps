import { DraftInputId } from '@tloncorp/api';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import { DraftInputContext } from '../draftInputs';
import { DraftInputContextProvider } from '../draftInputs/shared';

export function DraftInputView(props: {
  draftInputContext: DraftInputContext;
  type: DraftInputId;
}) {
  const { inputs } = useComponentsKitContext();
  const InputComponent = inputs[props.type];
  if (InputComponent) {
    return (
      <DraftInputContextProvider value={props.draftInputContext}>
        <InputComponent draftInputContext={props.draftInputContext} />
      </DraftInputContextProvider>
    );
  }
}
