import { useEffect, useState } from 'react';

import { useAttachmentContext } from '../../contexts/attachment';
import AttachmentSheet from '../AttachmentSheet';
import { Icon } from '../Icon';
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

  const { attachAssets } = useAttachmentContext();

  return (
    <>
      <IconButton
        backgroundColor="unset"
        onPress={() => setShowInputSelector(true)}
      >
        <Icon type="Add" />
      </IconButton>
      <AttachmentSheet
        showAttachmentSheet={showInputSelector}
        setShowAttachmentSheet={setShowInputSelector}
        setImage={attachAssets}
      />
    </>
  );
}
