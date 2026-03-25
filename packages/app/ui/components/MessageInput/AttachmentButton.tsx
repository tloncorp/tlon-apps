import { Button } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { isWeb } from 'tamagui';

import { normalizeUploadIntents, pickFile } from '../../../utils/filepicker';
import { useAttachmentContext } from '../../contexts';
import AttachmentSheet from '../AttachmentSheet';

export default function AttachmentButton({
  setShouldBlur,
  mediaType,
}: {
  setShouldBlur: (shouldBlur: boolean) => void;
  mediaType: 'image' | 'all';
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);
  const { attachAssets } = useAttachmentContext();

  useEffect(() => {
    if (showInputSelector) {
      setShouldBlur(true);
    }
  }, [showInputSelector, setShouldBlur]);

  const handlePress = async () => {
    // On web with full attachment support, skip the sheet and go straight to
    // the file picker — normalizeUploadIntents promotes images/video/audio to
    // the correct attachment type automatically.
    if (isWeb && mediaType === 'all') {
      const uploadIntents = await pickFile();
      const { uploadIntents: normalized } =
        await normalizeUploadIntents(uploadIntents);
      if (normalized.length > 0) {
        attachAssets(normalized);
      }
      return;
    }
    setShowInputSelector(true);
  };

  return (
    <>
      <Button
        preset="secondary"
        icon="Add"
        onPress={handlePress}
      />
      <AttachmentSheet
        isOpen={showInputSelector}
        onOpenChange={setShowInputSelector}
        mediaType={mediaType}
      />
    </>
  );
}
