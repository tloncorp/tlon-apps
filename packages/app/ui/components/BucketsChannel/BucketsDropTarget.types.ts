import { ComponentProps, ComponentType } from 'react';
import { View } from 'tamagui';

export type BucketUploadCandidate = {
  name: string;
  size: number;
  mimeType?: string;
  uri?: string;
  file?: File;
};

export type BucketsDropTargetComponent = ComponentType<
  {
    disabled?: boolean;
    dropLabel: string;
    onFilesDropped?: (files: BucketUploadCandidate[]) => void;
  } & ComponentProps<typeof View>
>;
