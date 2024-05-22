import React, { createContext, useContext } from 'react';
import {
  Easing,
  type SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type ScrollContextTuple = [SharedValue<number>, () => void];

// @ts-expect-error - No other props than value are needed
const INITIAL_VALUE: ScrollContextTuple = [{ value: 0 }, () => {}];

export const ScrollContext = createContext<ScrollContextTuple>(INITIAL_VALUE);

export const useScrollContext = () => useContext(ScrollContext);

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
