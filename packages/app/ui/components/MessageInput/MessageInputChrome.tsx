import { PropsWithChildren } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { View, XStack } from 'tamagui';

export const usesFloatingMessageInputChrome = false;
export const floatingMessageInputBottomInset = 0;

export function MessageInputChromeRow({
  children,
  onLayout,
}: PropsWithChildren<{
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  return (
    <XStack
      paddingVertical="$s"
      paddingHorizontal="$xl"
      gap="$l"
      alignItems="flex-end"
      justifyContent="space-between"
      backgroundColor="$background"
      disableOptimization
      onLayout={onLayout}
    >
      {children}
    </XStack>
  );
}

export function MessageInputChromeAction({
  children,
  bottomSpacing = 'xs',
}: PropsWithChildren<{
  bottomSpacing?: 'xs' | '2xs';
}>) {
  return (
    <View marginBottom={bottomSpacing === '2xs' ? '$2xs' : '$xs'}>
      {children}
    </View>
  );
}

export function MessageInputChromeBody({
  children,
}: PropsWithChildren<{
  isEditing: boolean;
  editingTintColor: string;
}>) {
  return (
    <XStack flex={1} gap="$l" alignItems="flex-end">
      {children}
    </XStack>
  );
}
