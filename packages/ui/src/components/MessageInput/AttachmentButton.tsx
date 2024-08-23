import { useEffect, useState } from 'react';

import { useAttachmentContext } from '../../contexts/attachment';
import AttachmentSheet from '../AttachmentSheet';
import { Button } from '../Button';
import { Icon } from '../Icon';

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
      <Button
        backgroundColor="unset"
        borderColor="transparent"
        onPress={() => setShowInputSelector(true)}
      >
        <Icon type="Add" />
      </Button>
      <AttachmentSheet
        showAttachmentSheet={showInputSelector}
        setShowAttachmentSheet={setShowInputSelector}
        setImage={attachAssets}
      />
    </>
  );
}
