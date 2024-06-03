import { useEditorBridge } from '@10play/tentap-editor';
import { InputToolbar } from '@tloncorp/ui';
import { TlonEditorBridge } from '@tloncorp/ui/src/components/MessageInput/toolbarActions';

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
