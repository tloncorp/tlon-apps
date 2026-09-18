import { PropsWithChildren } from 'react';
import { View } from 'tamagui';

export function AnimatedInputHeight({
  children,
}: PropsWithChildren<{ minimumHeight: number }>) {
  return <View position="relative">{children}</View>;
}
