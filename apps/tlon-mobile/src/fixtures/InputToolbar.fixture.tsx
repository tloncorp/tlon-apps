import { useEditorBridge } from '@10play/tentap-editor';
import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';
import { InputToolbar } from '@tloncorp/ui/components/MessageInput/InputToolbar.native';
import { TlonEditorBridge } from '@tloncorp/ui/components/MessageInput/toolbarActions.native';

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
