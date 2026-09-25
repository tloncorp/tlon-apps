import { View } from 'tamagui';

import { BucketsDropTargetComponent } from './BucketsDropTarget.types';

export const BucketsDropTarget: BucketsDropTargetComponent = ({
  disabled: _disabled,
  dropLabel: _dropLabel,
  onFilesDropped: _onFilesDropped,
  ...props
}) => <View {...props} />;
