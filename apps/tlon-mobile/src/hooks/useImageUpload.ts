import type {
  MessageAttachments,
  RNFile,
  UploadInfo,
  UploadParams,
  UploadedFile,
} from '@tloncorp/shared/dist/api';
import {
  SizedImage,
  handleImagePicked,
  useUploader,
} from '@tloncorp/shared/dist/store';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';

import { imageSize, resizeImage } from '../utils/images';

export function useImageUpload(props: UploadParams): UploadInfo {
  const uploader = useUploader(
    `channel-${props.uploaderKey}`,
    imageSize,
    nativeUploader
  );

  const [attachments, setAttachments] = useState<MessageAttachments>([]);
  const [resizedImage, setResizedImage] = useState<SizedImage | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedFile | null>(null);
  const mostRecentFile = uploader?.getMostRecent();
  const [startedImageUpload, setStartedImageUpload] = useState(false);

  const resetImageAttachment = useCallback(() => {
    setResizedImage(null);
    setAttachments([]);
    setUploadedImage(null);
    setStartedImageUpload(false);
    uploader?.clear();
  }, [uploader]);

  useEffect(() => {
    // if the most recent file is null, but we have an uploaded image, it means
    // that the image was successfully uploaded and we should reset the state
    // This is a bit of a hack to get around the fact that
    // some race condition can cause the uploadedImage to stick around after
    // resetImageAttachment is called from a consumer of the hook
    if (mostRecentFile === null && uploadedImage !== null) {
      resetImageAttachment();
    }
  }, [mostRecentFile, uploadedImage, resetImageAttachment]);

  useEffect(() => {
    const getResizedImage = async (uri: string) => {
      const manipulated = await resizeImage(uri);
      if (manipulated) {
        setResizedImage(manipulated);
      }
    };

    if (attachments.length && !startedImageUpload) {
      // step 1: resize the image and store the updated URI for now we only handle
      // the first attachment
      if (!resizedImage) {
        getResizedImage(attachments[0].uri);
      }

      // step 2: pass the resized image to FileStore to handle the upload
      if (uploader && resizedImage) {
        handleImagePicked(resizedImage, uploader);
        setStartedImageUpload(true);
      }
    }
  }, [attachments, mostRecentFile, uploader, startedImageUpload, resizedImage]);

  useEffect(() => {
    // step 3: after we detect that the upload is complete, return it to any
    // consumers of the hook
    if (
      mostRecentFile &&
      (mostRecentFile.status === 'success' ||
        mostRecentFile.status === 'loading')
    ) {
      const uploadedImage = {
        url: mostRecentFile.url,
        height: mostRecentFile.size[0],
        width: mostRecentFile.size[1],
      };
      setUploadedImage(uploadedImage);
    }
  }, [mostRecentFile, uploader]);

  return {
    uploadedImage,
    imageAttachment: resizedImage?.uri ?? null,
    setAttachments,
    resetImageAttachment,
    canUpload: !!uploader,
    uploading: !!mostRecentFile && mostRecentFile.status !== 'success',
  };
}

// This uses an expo package to handle file uploads from the native context. It doesn't suffer
// from any of the redirect/blob issues we saw with a hermes fetch based approach
async function nativeUploader(
  presignedUrl: string,
  file: RNFile,
  withPolicyHeader?: boolean
) {
  const headers: Record<string, string> = { 'Content-Type': file.type };
  // some custom S3's require this header, but it breaks Memex so we only
  // add it conditionally
  if (withPolicyHeader) {
    headers['x-amz-acl'] = 'public-read';
  }

  try {
    const response = await FileSystem.uploadAsync(presignedUrl, file.uri, {
      httpMethod: 'PUT',
      headers,
    });

    if (response.status !== 200) {
      throw new Error(`Got bad upload response ${response.status}`);
    }
  } catch (err) {
    console.error('Native upload failed', err);
    throw err;
  }
}
