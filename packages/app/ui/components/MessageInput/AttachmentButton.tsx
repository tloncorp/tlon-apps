import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { useEffect, useState } from 'react';

import AttachmentSheet from '../AttachmentSheet';

export default function AttachmentButton({
  setShouldBlur,
  mediaType,
}: {
  setShouldBlur: (shouldBlur: boolean) => void;
  mediaType: 'image' | 'all';
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);

  useEffect(() => {
    if (showInputSelector) {
      setShouldBlur(true);
    }
  }, [showInputSelector, setShouldBlur]);

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
        mediaType={mediaType}
      />
    </>
  );
}
