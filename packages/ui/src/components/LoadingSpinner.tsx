import classNames from 'classnames';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  View,
  useColorScheme,
} from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { ColorTokens } from 'tamagui';

import { Spinner } from '../core';

type Props = {
  height?: number;
  durationMs?: number;
};

export function LoadingSpinner({
  size,
  color,
}: {
  size?: 'large' | 'small';
  color?: ColorTokens;
}) {
  return <Spinner size={size} color={color ?? '$color.gray700'} />;
}

// Do not use this, here for reference only
const LegacySpinner = ({ height = 24, durationMs = 1000 }: Props) => {
  const rotationDegree = useRef(new Animated.Value(0)).current;
  const tailwind = useTailwind();
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    if (Platform.OS === 'ios') {
      Animated.loop(
        Animated.timing(rotationDegree, {
          toValue: 360,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [durationMs, rotationDegree]);

  // Android styling is off, use default spinner which looks better
  if (Platform.OS === 'android') {
    return (
      <ActivityIndicator
        size={height >= 24 ? 'large' : 'small'}
        color={isDarkMode ? '#fff' : '#000'}
      />
    );
  }

  return (
    <View
      style={{
        width: height,
        height,
      }}
      accessibilityRole="progressbar"
    >
      <View
        style={[
          tailwind(
            'w-full h-full rounded-full border-4 border-black dark:border-white opacity-20'
          ),
        ]}
      />
      <Animated.View
        style={[
          tailwind(
            classNames(
              'absolute w-full h-full',
              Platform.OS === 'ios'
                ? 'border-4 border-transparent border-t-black dark:border-t-white'
                : 'border-t-4 border-black dark:border-white'
            )
          ),
          {
            borderRadius: height / 2,
            transform: [
              {
                rotateZ: rotationDegree.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
};
