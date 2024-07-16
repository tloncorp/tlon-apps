import { useEffect, useState } from 'react';

import { Add } from '../../assets/icons';
import { useMessageInputContext } from '../../contexts/messageInput';
import AttachmentSheet from '../AttachmentSheet';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  setShouldBlur,
}: {
  setShouldBlur: (shouldBlur: boolean) => void;
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);

  useEffect(() => {
    if (showInputSelector) {
      setShouldBlur(true);
    }
  }, [showInputSelector, setShouldBlur]);

  const { attachAssets } = useMessageInputContext();

  return (
    <>
      <IconButton
        backgroundColor="unset"
        onPress={() => setShowInputSelector(true)}
      >
        <Add />
      </IconButton>
      <AttachmentSheet
        showAttachmentSheet={showInputSelector}
        setShowAttachmentSheet={setShowInputSelector}
        setImage={attachAssets}
      />
    </>
  );
}
