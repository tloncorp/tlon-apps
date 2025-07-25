import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Dimensions, Platform } from 'react-native';
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

export const useScrollDirectionTracker = ({
  setIsAtBottom: setIsAtBottomProp,
  atBottomThreshold = 1, // multiple of screen/viewport height
}: {
  setIsAtBottom?: (isAtBottom: boolean) => void;
  atBottomThreshold?: number;
} = {}) => {
  const [scrollValue] = useScrollContext();
  const previousScrollValue = useSharedValue(0);
  const previousAtBottom = useSharedValue(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const viewportHeight = useViewportHeight();

  const AT_BOTTOM_THRESHOLD = useMemo(
    () => viewportHeight * atBottomThreshold,
    [viewportHeight, atBottomThreshold]
  );

  useEffect(() => {
    setIsAtBottomProp?.(isAtBottom);
  }, [isAtBottom, setIsAtBottomProp]);

  return {
    onScroll: useAnimatedScrollHandler((event) => {
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

      const atBottom = y <= AT_BOTTOM_THRESHOLD;

      if (previousAtBottom.value !== atBottom) {
        previousAtBottom.value = atBottom;
        runOnJS(setIsAtBottom)(atBottom);
      }
    }),
    isAtBottom,
  };
};

function useViewportHeight() {
  const [height, setHeight] = useState(
    Platform.OS === 'web' ? window.innerHeight : Dimensions.get('window').height
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => setHeight(window.innerHeight);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return height;
}

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
