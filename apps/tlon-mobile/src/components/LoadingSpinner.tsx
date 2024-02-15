import classNames from 'classnames';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { IS_ANDROID, IS_IOS } from '../constants';
import { useIsDarkMode } from '../hooks/useIsDarkMode';

type Props = {
  height?: number;
  durationMs?: number;
};

export const LoadingSpinner = ({ height = 24, durationMs = 1000 }: Props) => {
  const rotationDegree = useRef(new Animated.Value(0)).current;
  const tailwind = useTailwind();
  const isDarkMode = useIsDarkMode();

  useEffect(() => {
    if (IS_IOS) {
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
  if (IS_ANDROID) {
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
              IS_IOS
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
