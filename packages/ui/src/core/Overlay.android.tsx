import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { ComponentProps } from 'react';

import { useAppContext } from '../contexts';
import { View } from './tamagui';

export function Overlay(props: ComponentProps<typeof View>) {
  const { theme } = useAppContext();
  return (
    <MotiView
      style={{ flex: 1 }}
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        opacity: {
          type: 'timing',
          delay: 150,
          duration: 100,
        },
      }}
    >
      <View
        flex={1}
        opacity={0.4}
        backgroundColor={theme === 'dark' ? '$white' : '$black'}
        {...props}
      ></View>
    </MotiView>
  );
}
