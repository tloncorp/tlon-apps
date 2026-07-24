import { PropsWithChildren } from 'react';
import { View, XStack } from 'tamagui';

const materialSurfaceProps = {
  backgroundColor: '$secondaryBackground',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.24)',
} as const;

export function ScreenHeaderControlsChrome({ children }: PropsWithChildren) {
  return (
    <XStack alignItems="center" gap={8}>
      {children}
    </XStack>
  );
}

export function ScreenHeaderControlChrome({ children }: PropsWithChildren) {
  return (
    <View
      {...materialSurfaceProps}
      minWidth={48}
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
