import React, { createContext, useContext } from 'react';
import {
  Easing,
  type SharedValue,
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { clamp } from 'react-native-reanimated';

type ScrollContextTuple = [SharedValue<number>, () => void];

// @ts-expect-error - No other props than value are needed
const INITIAL_VALUE: ScrollContextTuple = [{ value: 0 }, () => {}];

export const ScrollContext = createContext<ScrollContextTuple>(INITIAL_VALUE);

export const useScrollContext = () => useContext(ScrollContext);

export const useScrollDirectionTracker = (
  setIsAtBottom: (isAtBottom: boolean) => void
) => {
  const [scrollValue] = useScrollContext();
  const previousScrollValue = useSharedValue(0);
  const isAtBottom = useSharedValue(true);

  return useAnimatedScrollHandler((event) => {
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

    const atBottom = y <= 0;
    if (isAtBottom.value !== atBottom) {
      isAtBottom.value = atBottom;
      runOnJS(setIsAtBottom)(atBottom);
    }
  });
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
