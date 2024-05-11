import type {
  MessageAttachments,
  UploadInfo,
  UploadParams,
  UploadedFile,
} from '@tloncorp/shared/dist/api';
import {
  getFinalMemexUrl,
  getMemexUploadUrl,
  handleImagePicked,
  useUploader,
} from '@tloncorp/shared/dist/store';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';

import { imageSize, resizeImage } from '../utils/images';
import { useCurrentUserId } from './useCurrentUser';

export function useImageUpload(props: UploadParams): UploadInfo {
  const currentUserId = useCurrentUserId();
  const uploader = useUploader(`channel-${props.uploaderKey}`, imageSize);
  const [resizedImage, setResizedImage] = useState<UploadedFile | null>(null);
  const mostRecentFile = uploader?.getMostRecent();
  const [attachments, setAttachments] = useState<MessageAttachments>([]);
  const [startedImageUpload, setStartedImageUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetImageAttachment = useCallback(() => {
    setResizedImage(null);
    setAttachments([]);
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

    async function handle() {
      if (attachments.length && !startedImageUpload) {
        const attachment = attachments[0];
        console.log('GOT ATTACHMENT', attachment);
        console.log(`uri`, attachment.uri);
        console.log(attachment.base64);
        if (!resizedImage) {
          getResizedImage(attachment.uri);
        }

        if (uploader && resizedImage) {
          setStartedImageUpload(true);

          try {
            // hosting upload
            setUploading(true);
            const uploadPath = await getMemexUploadUrl(
              currentUserId,
              attachment.fileName ?? ''
            );

            console.log(`trying filesystem upload`, uploadPath);
            const response = await FileSystem.uploadAsync(
              uploadPath,
              attachment.uri,
              {
                httpMethod: 'PUT',
                headers: {
                  'Content-Type': 'image/jpeg',
                },
              }
            );

            console.log('it worked?');
            console.log(response.status);

            if (response.status !== 200) {
              throw new Error('Failed to upload to memex');
            }

            const finalUrl = await getFinalMemexUrl(uploadPath);

            setUploadedImage({ ...resizedImage, url: finalUrl });
          } catch (e) {
            console.error('Failed to upload hosting image', e);
            resetImageAttachment();
          } finally {
            setUploading(false);
          }
        }
      }
    }

    handle();
  }, [
    attachments,
    mostRecentFile,
    uploader,
    startedImageUpload,
    resizedImage,
    currentUserId,
    resetImageAttachment,
  ]);

  // useEffect(() => {
  //   if (
  //     mostRecentFile &&
  //     (mostRecentFile.status === 'success' ||
  //       mostRecentFile.status === 'loading')
  //   ) {
  //     setUploadedImage(mostRecentFile);

  //     if (mostRecentFile.status === 'success' && mostRecentFile.url !== '') {
  //       uploader?.clear();
  //     }
  //   }
  // }, [mostRecentFile, uploader]);

  return {
    uploadedImage,
    imageAttachment: resizedImage?.url ?? null,
    setAttachments,
    resetImageAttachment,
    canUpload: !!uploader,
    uploading,
  };
}
