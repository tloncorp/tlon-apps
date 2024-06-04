import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SizableText, View } from '../core';

export function ScreenLoader() {
  const { top } = useSafeAreaInsets();

  return (
    <Animated.View
      style={{
        position: 'absolute',
        zIndex: 55,
        top: 0,
        left: 0,
        width: '100%',
      }}
      entering={FadeInUp}
      exiting={FadeOutUp}
    >
      <View
        height={top + 20}
        paddingBottom="$xs"
        backgroundColor="$secondaryBackground"
        justifyContent="flex-end"
        alignItems="center"
      >
        <SizableText size={'$s'} color={'$primaryText'}>
          Loading…
        </SizableText>
      </View>
    </Animated.View>
  );
}
