import { useEditorBridge } from '@10play/tentap-editor';
import { InputToolbar } from '@tloncorp/ui';
import { TlonEditorBridge } from '@tloncorp/ui/src/components/MessageInput/toolbarActions.native';

import { FixtureWrapper } from './FixtureWrapper';

const InputToolbarFixture = () => {
  const editor = useEditorBridge() as TlonEditorBridge;

  return (
    <FixtureWrapper fillWidth fillHeight>
      {/* @ts-expect-error we haven't typed the web version yet */}
      <InputToolbar hidden={false} editor={editor} />
    </FixtureWrapper>
  );
};

export default {
  default: InputToolbarFixture,
};
