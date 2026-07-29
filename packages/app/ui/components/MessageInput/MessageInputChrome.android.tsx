import { PropsWithChildren } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { View, XStack } from 'tamagui';

import { floatingChromeMetrics as metrics } from '../floatingChromeMetrics';

export const usesFloatingMessageInputChrome = true;
export const floatingMessageInputBottomInset = 0;

const materialSurfaceProps = {
  backgroundColor: '$secondaryBackground',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.24)',
} as const;

export function MessageInputChromeRow({
  children,
  onLayout,
}: PropsWithChildren<{
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  return (
    <XStack
      width="100%"
      alignItems="center"
      gap={metrics.rowGap}
      paddingHorizontal={metrics.rowPaddingHorizontal}
      paddingVertical={metrics.rowPaddingVertical}
      backgroundColor="transparent"
      onLayout={onLayout}
    >
      {children}
    </XStack>
  );
}

export function MessageInputChromeAction({
  children,
}: PropsWithChildren<{
  bottomSpacing?: 'xs' | '2xs';
}>) {
  return (
    <View
      {...materialSurfaceProps}
      width={metrics.controlSize}
      height={metrics.controlSize}
      borderRadius={metrics.controlRadius}
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </View>
  );
}

export function MessageInputChromeBody({
  children,
  isEditing,
}: PropsWithChildren<{
  isEditing: boolean;
  editingTintColor: string;
}>) {
  return (
    <XStack
      {...materialSurfaceProps}
      flex={1}
      minHeight={metrics.controlSize}
      borderRadius={metrics.controlRadius}
      alignItems="center"
      gap={metrics.rowGap}
      backgroundColor={
        isEditing ? '$positiveBackground' : '$secondaryBackground'
      }
      overflow="hidden"
    >
      {children}
    </XStack>
  );
}
