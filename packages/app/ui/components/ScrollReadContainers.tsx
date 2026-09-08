import { forwardRef } from 'react';
import { View } from 'react-native';

import type { NativeReadContainerProps } from './ScrollReadContainers.types';

const Container = forwardRef<View, NativeReadContainerProps>(
  function NativeReadContainer({ descriptor: _descriptor, ...props }, ref) {
    return <View {...props} ref={ref} />;
  }
);
export const NativeReadScopeContainer = Container;
export const NativeReadItemContainer = Container;
