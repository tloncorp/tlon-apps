import { Attachment } from '@tloncorp/shared/domain';
import { ImagePickerAsset } from 'expo-image-picker';
import { ComponentProps, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { View } from 'tamagui';

export function FileDrop({
  onAssetsDropped,
  children,
  ...props
}: {
  onAssetsDropped: (files: Attachment.UploadIntent[]) => void;
} & ComponentProps<typeof View>) {
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
        tag="input"
        width={0}
        height={0}
        position="absolute"
      />
      {children}
    </View>
  );
}

function getImageAsset(
  file: File
): Promise<{ uri: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onerror = (e) => {
      reject(e);
    };
    img.onload = function () {
      resolve({ uri: objectUrl, width: img.width, height: img.height });
    };
    img.src = objectUrl;
  });
}
