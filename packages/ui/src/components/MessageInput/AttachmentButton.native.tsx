import {
  MessageAttachments,
  Upload,
  UploadInfo,
} from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { Add } from '../../assets/icons';
import { Spinner, View } from '../../core';
import { ActionSheet } from '../ActionSheet';
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
        <IconButton onPress={() => setShowInputSelector(true)}>
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
