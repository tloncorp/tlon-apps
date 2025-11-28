import { Attachment } from '@tloncorp/shared/domain';
import { ComponentProps, ComponentType } from 'react';
import { View } from 'tamagui';

export type FileDropComponent = ComponentType<
  {
    onAssetsDropped: (files: Attachment.UploadIntent[]) => void;
  } & ComponentProps<typeof View>
>;
