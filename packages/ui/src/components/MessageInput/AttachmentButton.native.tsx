import { UploadInfo } from '@tloncorp/shared/dist/api';
import { useState } from 'react';

import { Add } from '../../assets/icons';
import { Spinner, View } from '../../core';
import AttachmentSheet from '../AttachmentSheet';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  uploadInfo,
}: {
  uploadInfo: UploadInfo;
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);

  return (
    <>
      {uploadInfo.uploadedImage && uploadInfo.uploadedImage.url === '' ? (
        <View alignItems="center" padding="$m">
          <Spinner />
        </View>
      ) : (
        <IconButton
          backgroundColor="unset"
          onPress={() => setShowInputSelector(true)}
        >
          <Add />
        </IconButton>
      )}
      <AttachmentSheet
        showAttachmentSheet={showInputSelector}
        setShowAttachmentSheet={setShowInputSelector}
        setImage={uploadInfo.setAttachments}
      />
    </>
  );
}
