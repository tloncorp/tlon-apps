import { Button } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { isWeb } from 'tamagui';

import { pickFile } from '../../../utils/filepicker';
import { useAttachmentContext } from '../../contexts';
import AttachmentSheet from '../AttachmentSheet';

export default function AttachmentButton({
  setShouldBlur,
}: {
  setShouldBlur: (shouldBlur: boolean) => void;
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);
  const { attachAssets } = useAttachmentContext();

  useEffect(() => {
    if (showInputSelector) {
      setShouldBlur(true);
    }
  }, [showInputSelector, setShouldBlur]);

  const handlePress = async () => {
    // On web, skip the sheet and go straight to the system file picker.
    if (isWeb) {
      const { uploadIntents } = await pickFile();
      if (uploadIntents.length > 0) {
        attachAssets(uploadIntents);
      }
      return;
    }
    setShowInputSelector(true);
  };

  return (
    <>
      <Button preset="secondary" icon="Add" onPress={handlePress} />
      <AttachmentSheet
        isOpen={showInputSelector}
        onOpenChange={setShowInputSelector}
        mediaType="all"
      />
    </>
  );
}
