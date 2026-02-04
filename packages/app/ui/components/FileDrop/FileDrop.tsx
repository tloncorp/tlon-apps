import { Attachment } from '@tloncorp/shared/domain';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { View } from 'tamagui';

import { isLikelyVideoSource } from '../../contexts/attachmentRules';
import { getVideoPreviewData } from '../../utils/videoPreviewData';
import { FileDropComponent } from './types';

export const FileDrop: FileDropComponent = ({
  onAssetsDropped,
  children,
  ...props
}) => {
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
              isLikelyVideoSource({
                mimeType: file.type,
                name: file.name,
              })
            ) {
              const video = await getVideoPreviewData({ file });
              return Attachment.UploadIntent.fromFile(file, { video });
            }
            return Attachment.UploadIntent.fromFile(file);
          })
        )
      );
    },
    [onAssetsDropped]
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
        render="input"
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
