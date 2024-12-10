import { ImagePickerAsset } from 'expo-image-picker';
import { ComponentProps } from 'react';
import { View } from 'tamagui';

export function FileDrop({
  onFilesDropped: _onFilesDropped,
  ...props
}: {
  onFilesDropped: (files: ImagePickerAsset[]) => void;
} & ComponentProps<typeof View>) {
  return <View {...props} />;
}
