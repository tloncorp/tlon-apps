import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient, View } from '../core';

export function ScreenMask() {
  const { top } = useSafeAreaInsets();

  return (
    <View height={top + 50} position="absolute" width="100%" zIndex={50}>
      <LinearGradient
        height="100%"
        colors={['$background', '$transparentBackground']}
      />
    </View>
  );
}
