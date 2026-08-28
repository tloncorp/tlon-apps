import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
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

export type ConversationScrollToBottomControl = {
  isLoading: boolean;
  onPress: () => void;
  visible: boolean;
};

// @ts-expect-error - No other props than value are needed
const INITIAL_VALUE: ScrollContextTuple = [{ value: 0 }, () => {}];

export const ScrollContext = createContext<ScrollContextTuple>(INITIAL_VALUE);

const defaultConversationScrollViewNativeID =
  'tlon-conversation-scroll-edge-content';
const ConversationScrollViewNativeIDContext = createContext(
  defaultConversationScrollViewNativeID
);
export type ConversationScrollEndAnchorHandler = {
  capture: () => void;
  restore: () => void;
};
const ConversationScrollEndAnchorContext = createContext<{
  capture: () => void;
  register: (handler: ConversationScrollEndAnchorHandler) => () => void;
  restore: () => void;
} | null>(null);
// Scroller owns the scroll-position state, while the composer renders the
// control so all iOS actions can share one native GlassContainer. This small
// cross-tree channel keeps that presentation detail out of both components.
const ConversationScrollToBottomContext = createContext<{
  control: ConversationScrollToBottomControl | null;
  setControl: React.Dispatch<
    React.SetStateAction<ConversationScrollToBottomControl | null>
  >;
}>({ control: null, setControl: () => {} });

export const useScrollContext = () => useContext(ScrollContext);
export const useConversationScrollViewNativeID = () =>
  useContext(ConversationScrollViewNativeIDContext);
export const useConversationScrollEndAnchor = () =>
  useContext(ConversationScrollEndAnchorContext);
export const useConversationScrollToBottomControl = () =>
  useContext(ConversationScrollToBottomContext).control;
export const useSetConversationScrollToBottomControl = () =>
  useContext(ConversationScrollToBottomContext).setControl;

export const useScrollDirectionTracker = ({
  setIsAtBottom: setIsAtBottomProp,
  atBottomThreshold = 1, // multiple of screen/viewport height
  bottomAtEnd = false,
}: {
  setIsAtBottom?: (isAtBottom: boolean) => void;
  atBottomThreshold?: number;
  bottomAtEnd?: boolean;
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

  const scrollHandler = useAnimatedScrollHandler((event) => {
    const { y } = event.contentOffset;
    const maxOffset = Math.max(
      0,
      event.contentSize.height -
        event.layoutMeasurement.height +
        (event.contentInset?.bottom ?? 0)
    );
    const distanceFromBottom = bottomAtEnd ? maxOffset - y : y;

    if (
      distanceFromBottom < 0 ||
      distanceFromBottom > event.contentSize.height
    ) {
      return;
    }

    scrollValue.value = clamp(
      scrollValue.value +
        (distanceFromBottom - previousScrollValue.value) / 200,
      0,
      1
    );

    previousScrollValue.value = distanceFromBottom;

    const atBottom = distanceFromBottom <= AT_BOTTOM_THRESHOLD;

    if (previousAtBottom.value !== atBottom) {
      previousAtBottom.value = atBottom;
      runOnJS(setIsAtBottom)(atBottom);
    }
  });

  return useMemo(
    () => ({
      onScroll: scrollHandler,
      isAtBottom,
    }),
    [scrollHandler, isAtBottom]
  );
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
  const scrollValue = useSharedValue(0);
  const conversationScrollEndAnchor =
    useRef<ConversationScrollEndAnchorHandler | null>(null);
  const scrollViewNativeID = `${defaultConversationScrollViewNativeID}-${useId()}`;
  const [scrollToBottomControl, setScrollToBottomControl] =
    useState<ConversationScrollToBottomControl | null>(null);

  const handleReset = useCallback(() => {
    scrollValue.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [scrollValue]);

  const contextValue = useMemo(
    () => [scrollValue, handleReset] as ScrollContextTuple,
    [scrollValue, handleReset]
  );
  const scrollToBottomContextValue = useMemo(
    () => ({
      control: scrollToBottomControl,
      setControl: setScrollToBottomControl,
    }),
    [scrollToBottomControl]
  );
  const scrollEndAnchorContextValue = useMemo(
    () => ({
      capture: () => conversationScrollEndAnchor.current?.capture(),
      register: (handler: ConversationScrollEndAnchorHandler) => {
        conversationScrollEndAnchor.current = handler;
        return () => {
          if (conversationScrollEndAnchor.current === handler) {
            conversationScrollEndAnchor.current = null;
          }
        };
      },
      restore: () => conversationScrollEndAnchor.current?.restore(),
    }),
    []
  );

  return (
    <ConversationScrollEndAnchorContext.Provider
      value={scrollEndAnchorContextValue}
    >
      <ConversationScrollToBottomContext.Provider
        value={scrollToBottomContextValue}
      >
        <ConversationScrollViewNativeIDContext.Provider
          value={scrollViewNativeID}
        >
          <ScrollContext.Provider value={contextValue}>
            {children}
          </ScrollContext.Provider>
        </ConversationScrollViewNativeIDContext.Provider>
      </ConversationScrollToBottomContext.Provider>
    </ConversationScrollEndAnchorContext.Provider>
  );
};
