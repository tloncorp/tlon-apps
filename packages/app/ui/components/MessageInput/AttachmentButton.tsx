import { Attachment } from '@tloncorp/shared';
import { Button } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { normalizeUploadIntents, pickFile } from '../../../utils/filepicker';
import { useAttachmentContext } from '../../contexts';

export default function AttachmentButton({
  setShouldBlur,
}: {
  setShouldBlur: (shouldBlur: boolean) => void;
  mediaType: 'image' | 'all';
}) {
  const { attachAssets } = useAttachmentContext();

  const handlePress = useCallback(async () => {
    setShouldBlur(true);

    const uploadIntents = await pickFile();
    const { uploadIntents: normalizedUploadIntents, errorMessage } =
      await normalizeUploadIntents(uploadIntents);

    if (errorMessage) {
      Alert.alert('Unable to attach', errorMessage);
    }

    if (normalizedUploadIntents.length > 0) {
      attachAssets(normalizedUploadIntents);
    }
  }, [setShouldBlur, attachAssets]);

  return (
    <Button preset="secondary" icon="Add" onPress={handlePress} />
  );
}
