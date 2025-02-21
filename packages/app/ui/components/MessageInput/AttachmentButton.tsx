import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { useEffect, useState } from 'react';

import { useAttachmentContext } from '../../contexts/attachment';
import AttachmentSheet from '../AttachmentSheet';

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
        isOpen={showInputSelector}
        onOpenChange={setShowInputSelector}
        onAttachmentsSet={attachAssets}
      />
    </>
  );
}
