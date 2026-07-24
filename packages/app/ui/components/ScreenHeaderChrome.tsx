import { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function ScreenHeaderControlsChrome({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export function ScreenHeaderControlChrome({ children }: PropsWithChildren) {
  return <>{children}</>;
}
