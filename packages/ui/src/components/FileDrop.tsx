import { ImagePickerAsset } from 'expo-image-picker';
import { ComponentProps, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { View } from 'tamagui';

export function FileDrop({
  onAssetsDropped,
  children,
  ...props
}: {
  onAssetsDropped: (files: ImagePickerAsset[]) => void;
} & ComponentProps<typeof View>) {
  const handleDrop = useCallback(
    async (files: File[]) => {
      const measuredFiles = (
        await Promise.all(
          files.map(async (file) => {
            try {
              return await measureFile(file);
            } catch (e) {
              console.error('Error measuring file', e);
              return null;
            }
          })
        )
      ).filter((f) => f !== null) as {
        uri: string;
        width: number;
        height: number;
        file: File;
      }[];
      onAssetsDropped(measuredFiles);
    },
    [onAssetsDropped]
  );

  const { getInputProps, getRootProps } = useDropzone({
    onDrop: handleDrop,
    noClick: true,
    accept: {
      'image/*': [],
      'video/*': [],
    },
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

async function measureFile(f: File) {
  return {
    file: f,
    ...(f.type.startsWith('image')
      ? await getImageAsset(f)
      : await getVideoAsset(f)),
  };
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

function getVideoAsset(
  file: File
): Promise<{ uri: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.onerror = (e) => {
      reject(e);
    };
    video.onloadedmetadata = function () {
      resolve({
        uri: objectUrl,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    video.src = objectUrl;
  });
}
