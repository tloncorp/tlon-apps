import type {
  Upload,
  UploadInfo,
  UploadParams,
} from '@tloncorp/shared/dist/api';
import { handleImagePicked, useUploader } from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useState } from 'react';

import { imageSize, resizeImage } from '../utils/images';

export function useImageUpload(props: UploadParams): UploadInfo {
  const uploader = useUploader(`channel-${props.uploaderKey}`, imageSize);
  const [resizedImage, setResizedImage] = useState<string | null>(null);
  const mostRecentFile = uploader?.getMostRecent();
  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [startedImageUpload, setStartedImageUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<Upload | null | undefined>(
    null
  );

  const resetImageAttachment = useCallback(() => {
    setResizedImage(null);
    setImageAttachment(null);
    setUploadedImage(null);
    setStartedImageUpload(false);
    uploader?.clear();
  }, [uploader]);

  useEffect(() => {
    const getResizedImage = async (uri: string) => {
      const manipulated = await resizeImage(uri);
      if (manipulated) {
        setResizedImage(manipulated);
      }
    };

    if (imageAttachment && !startedImageUpload) {
      if (!resizedImage) {
        getResizedImage(imageAttachment);
      }

      if (uploader && resizedImage) {
        handleImagePicked(resizedImage, uploader);
        setStartedImageUpload(true);
      }
    }
  }, [
    imageAttachment,
    mostRecentFile,
    uploader,
    startedImageUpload,
    resizedImage,
  ]);

  useEffect(() => {
    if (
      mostRecentFile &&
      (mostRecentFile.status === 'success' ||
        mostRecentFile.status === 'loading')
    ) {
      setUploadedImage(mostRecentFile);

      if (mostRecentFile.status === 'success' && mostRecentFile.url !== '') {
        uploader?.clear();
      }
    }
  }, [mostRecentFile, uploader]);

  return {
    uploadedImage,
    imageAttachment: resizedImage,
    setImageAttachment,
    resetImageAttachment,
    canUpload: !!uploader,
  };
}
