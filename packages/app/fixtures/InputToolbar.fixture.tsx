import { useEditorBridge } from '@10play/tentap-editor';
import { InputToolbar } from '@tloncorp/ui/src/components/MessageInput/InputToolbar.native';
import { TlonEditorBridge } from '@tloncorp/ui/src/components/MessageInput/toolbarActions.native';

import { FixtureWrapper } from './FixtureWrapper';

const InputToolbarFixture = () => {
  const editor = useEditorBridge() as TlonEditorBridge;

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InputToolbar hidden={false} editor={editor} />
    </FixtureWrapper>
  );
};

export default {
  default: InputToolbarFixture,
};
