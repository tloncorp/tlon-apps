import { IconButton } from '@tloncorp/ui';
import { Add } from '@tloncorp/ui/assets/icons';
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
      <IconButton
        backgroundColor="unset"
        onPress={() => setShowInputSelector(true)}
      >
        <Add />
      </IconButton>
      <AttachmentSheet
        isOpen={showInputSelector}
        onOpenChange={setShowInputSelector}
        onAttachmentsSet={attachAssets}
      />
    </>
  );
}
