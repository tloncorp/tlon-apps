import { useEditorBridge } from '@10play/tentap-editor';
import { InputToolbar } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

const InputToolbarFixture = () => {
  const editor = useEditorBridge();

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InputToolbar hidden={false} editor={editor} />
    </FixtureWrapper>
  );
};

export default {
  default: InputToolbarFixture,
};
