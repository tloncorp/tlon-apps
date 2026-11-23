import { PropsWithChildren } from 'react';
import { View } from 'tamagui';

export function AnimatedInputHeight({
  children,
}: PropsWithChildren<{
  minimumHeight: number;
  holdHeight?: boolean;
  snapShrink?: boolean;
  onHeightSettled?: () => void;
}>) {
  return <View position="relative">{children}</View>;
}
