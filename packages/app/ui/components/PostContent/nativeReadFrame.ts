import type { ComponentProps } from 'react';
import { View, createComponent, styled } from 'tamagui';

import { NativeReadItemContainer } from '../ScrollReadContainers';

// Ask Tamagui to recognize the native base, then reuse the original frame's
// complete configuration. No asChild filtering, copied theme values or extra host.
const NativeReadBase = styled(
  NativeReadItemContainer,
  {},
  { isReactNative: true }
);

export function createNativeReadFrame<Props extends object>(
  frame: Pick<typeof View, 'staticConfig'>
) {
  return createComponent<Props & { descriptor?: string }>({
    ...frame.staticConfig,
    Component: NativeReadBase.staticConfig.Component,
    neverFlatten: true,
  });
}

export const NativeReadImageFrame =
  createNativeReadFrame<ComponentProps<typeof View>>(View);
