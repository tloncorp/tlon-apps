import { Attachment } from '@tloncorp/shared/domain';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { View } from 'tamagui';

import { useFeatureFlag } from '../../../lib/featureFlags';
import { isLikelyVideoSource } from '../../contexts/attachmentRules';
import { FileDropComponent } from './types';

export const FileDrop: FileDropComponent = ({
  onAssetsDropped,
  children,
  ...props
}) => {
  const [videoUploadPlayback] = useFeatureFlag('videoUploadPlayback');
  const handleDrop = useCallback(
    async (files: File[]) => {
      onAssetsDropped(
        await Promise.all(
          files.map(async (file) => {
            if (file.type.startsWith('image/')) {
              const asset = await getImageAsset(file);
              return {
                type: 'image',
                asset: {
                  mimeType: file.type,
                  fileSize: file.size,
                  ...asset,
                },
              };
            }
            if (
              videoUploadPlayback &&
              isLikelyVideoSource({
                mimeType: file.type,
                name: file.name,
              })
            ) {
              const asset = await getVideoAsset(file);
              return {
                type: 'file',
                file,
                video: asset,
              } as Attachment.UploadIntent;
            }
            return Attachment.UploadIntent.fromFile(file);
          })
        )
      );
    },
    [onAssetsDropped, videoUploadPlayback]
  );

  const { getInputProps, getRootProps } = useDropzone({
    onDrop: handleDrop,
    noClick: true,
  });

  return (
    // @ts-expect-error reason: getRootProps() which is web specific return some react-native incompatible props, but it's fine
    <View {...getRootProps()} {...props}>
      {/* need an empty input div just have image drop feature in the web */}
      {/*  @ts-expect-error web-only props */}
      <View
        {...getInputProps()}
        tag="input"
        width={0}
        height={0}
        position="absolute"
      />
      {children}
    </View>
  );
};

function getImageAsset(
  file: File
): Promise<{ uri: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
    img.onload = function () {
      resolve({ uri: objectUrl, width: img.width, height: img.height });
    };
    img.src = objectUrl;
  });
}

function getVideoAsset(
  file: File
): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      });
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };
    video.src = objectUrl;
  });
}
