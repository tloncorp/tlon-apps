import { PropsWithChildren } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { View, XStack } from 'tamagui';

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
      gap={8}
      paddingHorizontal={12}
      paddingVertical={8}
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
      width={48}
      height={48}
      borderRadius={24}
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
      minHeight={48}
      borderRadius={24}
      alignItems="center"
      gap={8}
      backgroundColor={
        isEditing ? '$positiveBackground' : '$secondaryBackground'
      }
      overflow="hidden"
    >
      {children}
    </XStack>
  );
}
