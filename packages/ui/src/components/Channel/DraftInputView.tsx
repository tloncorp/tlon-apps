import { DraftInputId } from '@tloncorp/shared';

import { useComponentsKitContext } from '../../contexts/componentsKits';
import { DraftInputContext } from '../draftInputs';

export function DraftInputView(props: {
  draftInputContext: DraftInputContext;
  type: DraftInputId;
}) {
  const { inputs } = useComponentsKitContext();
  const InputComponent = inputs[props.type];
  if (InputComponent) {
    return <InputComponent draftInputContext={props.draftInputContext} />;
  }
}
