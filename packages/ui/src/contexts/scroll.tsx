import React, { createContext, useContext } from 'react';
import {
  Easing,
  type SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { clamp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScrollContextTuple = [SharedValue<number>, () => void];

// @ts-expect-error - No other props than value are needed
const INITIAL_VALUE: ScrollContextTuple = [{ value: 0 }, () => {}];

export const ScrollContext = createContext<ScrollContextTuple>(INITIAL_VALUE);

export const useScrollContext = () => useContext(ScrollContext);

export const useScrollDirectionTracker = () => {
  const [scrollValue] = useScrollContext();
  const previousScrollValue = useSharedValue(0);
  const { bottom } = useSafeAreaInsets();
  return useAnimatedScrollHandler(
    (event) => {
      const { y } = event.contentOffset;

      if (y < 0 || y > event.contentSize.height) {
        return;
      }

      scrollValue.value = clamp(
        scrollValue.value + (y - previousScrollValue.value) / 200,
        0,
        1
      );

      previousScrollValue.value = y;
    },
    [bottom]
  );
};

export const ScrollContextProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  // Animated
  const scrollValue = useSharedValue(0);

  // Methods
  const handleReset = () => {
    scrollValue.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
  };

  return (
    <ScrollContext.Provider value={[scrollValue, handleReset]}>
      {children}
    </ScrollContext.Provider>
  );
};
