import { ImagePickerAsset } from 'expo-image-picker';
import { ComponentProps } from 'react';
import { View } from 'tamagui';

export function FileDrop(
  props: {
    onAssetsDropped: (files: ImagePickerAsset[]) => void;
  } & ComponentProps<typeof View>
) {
  return <View {...props} />;
}
