import { View } from 'tamagui';

import { FileDropComponent } from './types';

export const FileDrop: FileDropComponent = ({
  dropEnabled: _dropEnabled,
  ...props
}) => {
  return <View {...props} />;
};
