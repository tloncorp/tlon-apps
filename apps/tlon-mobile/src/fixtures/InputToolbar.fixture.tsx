import { useEditorBridge } from '@10play/tentap-editor';
import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';
import { InputToolbar } from '@tloncorp/app/ui/components/MessageInput/InputToolbar';
import { TlonEditorBridge } from '@tloncorp/app/ui/components/MessageInput/toolbarActions';

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
