import { Upload } from '@tloncorp/shared/dist/api';
import { useState } from 'react';

import { Add } from '../../assets/icons';
import { Spinner, View } from '../../core';
import AttachmentSheet from '../AttachmentSheet';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  setImage,
  uploadedImage,
}: {
  setImage: (uri: string | null) => void;
  uploadedImage?: Upload | null;
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);
  return (
    <>
      {uploadedImage && uploadedImage.url === '' ? (
        <View alignItems="center" padding="$m">
          <Spinner />
        </View>
      ) : (
        <IconButton onPress={() => setShowInputSelector(true)}>
          <Add />
        </IconButton>
      )}
      <AttachmentSheet
        showAttachmentSheet={showInputSelector}
        setShowAttachmentSheet={setShowInputSelector}
        setImage={setImage}
      />
    </>
  );
}
