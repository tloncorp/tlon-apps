import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as React from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
} from 'react-native';
import { Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Edges, SafeAreaView } from 'react-native-safe-area-context';
import { AnimatePresence, View, withStaticProperties } from 'tamagui';

import { ForwardingProps } from '../utils/react';

const CarouselContext = React.createContext<{
  direction: 'horizontal' | 'vertical';
  rect: { width: number; height: number } | null;
  setOverlay: (overlay: JSX.Element) => () => void;
  visibleIndex: number;
} | null>(null);

const CarouselItemContext = React.createContext<{
  index: number;
} | null>(null);

// Carousel must set its own width: it does not have to be fixed, but it should
// not rely on the inline dimension of its children. If a width is not
// provided, the Carousel will be rendered with a width of 0.
const _Carousel = React.forwardRef<
  {
    scrollToIndex: (index: number, animated?: boolean) => void;
  },
  ForwardingProps<
    typeof View,
    {
      onVisibleIndexChange?: (index: number) => void;
      scrollDirection?: 'horizontal' | 'vertical';
      hideOverlayOnTap?: boolean;
      initialVisibleIndex?: number;
      disableCarouselInteraction?: boolean;
      flatListProps?: Partial<
        React.ComponentPropsWithoutRef<typeof FlatList<React.ReactElement>>
      >;
    }
  >
>(function Carousel(
  {
    children,
    onVisibleIndexChange,
    scrollDirection = 'horizontal',
    hideOverlayOnTap = true,
    disableCarouselInteraction = false,
    flatListProps,
    initialVisibleIndex,
    ...passedProps
  },
  forwardedRef
) {
  const scrollRef = React.useRef<FlatList>(null);
  const [visibleIndex, setVisibleIndex] = React.useState(
    initialVisibleIndex ?? 0
  );
  const [isOverlayShown, setIsOverlayShown] = React.useState(false);
  const [overlay, setOverlay] = React.useState<JSX.Element | null>(null);
  const tap = Gesture.Tap()
    .onEnd((_event, success) => {
      success && runOnJS(setIsOverlayShown)(!isOverlayShown);
    })
    .enabled(hideOverlayOnTap);
  const [rect, setRect] = React.useState<{
    width: number;
    height: number;
  } | null>(null);

  const ctxValue = React.useMemo(
    () => ({
      direction: scrollDirection,
      rect,
      setOverlay: (overlay: JSX.Element) => {
        setOverlay(overlay);
        return () => setOverlay((prev) => (prev === overlay ? null : prev));
      },
      visibleIndex,
    }),
    [rect, scrollDirection, visibleIndex]
  );

  const handleLayout = React.useCallback((e: LayoutChangeEvent) => {
    setRect({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }, []);

  const snapToInterval =
    scrollDirection === 'horizontal' ? rect?.width : rect?.height;

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (snapToInterval == null) {
        return;
      }
      const index = Math.round(
        scrollDirection === 'horizontal'
          ? event.nativeEvent.contentOffset.x / snapToInterval
          : event.nativeEvent.contentOffset.y / snapToInterval
      );
      setVisibleIndex(index);
    },
    [scrollDirection, snapToInterval]
  );

  React.useEffect(() => {
    onVisibleIndexChange?.(visibleIndex);
  }, [visibleIndex, onVisibleIndexChange]);

  React.useImperativeHandle(forwardedRef, () => ({
    scrollToIndex(index: number, animated: boolean = true) {
      scrollRef.current?.scrollToIndex({ animated, index });
    },
  }));

  const childrenArray = React.useMemo(
    () => React.Children.toArray(children),
    [children]
  );

  const getItemLayout = React.useMemo<
    React.ComponentPropsWithoutRef<typeof FlatList>['getItemLayout']
  >(
    () =>
      rect == null
        ? undefined
        : (_data, index) => {
            const length =
              scrollDirection === 'horizontal' ? rect.width : rect.height;
            return {
              length,
              offset: length * index,
              index,
            };
          },
    [rect, scrollDirection]
  );

  return (
    <GestureDetector gesture={tap}>
      <View {...passedProps}>
        <CarouselContext.Provider value={ctxValue}>
          <FlatList<React.ReactNode>
            data={
              // Carousel's items will likely be sized to the viewport - if
              // they are shown before the viewport is measured, there's a good
              // chance that there will be a flash of 0-length items. If this
              // happens, the initial scroll position will be incorrect (once
              // the viewport length is resolved).
              // To avoid, only render once the viewport length is known.
              rect == null ? undefined : childrenArray
            }
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEnabled={!disableCarouselInteraction}
            initialScrollIndex={initialVisibleIndex}
            style={[
              {
                flexDirection:
                  scrollDirection === 'horizontal' ? 'row' : 'column',
              },
              StyleSheet.absoluteFill,
            ]}
            horizontal={scrollDirection === 'horizontal'}
            onLayout={handleLayout}
            onScroll={handleScroll}
            ref={scrollRef}
            scrollEventThrottle={33}
            showsVerticalScrollIndicator={scrollDirection !== 'vertical'}
            showsHorizontalScrollIndicator={scrollDirection !== 'horizontal'}
            snapToInterval={snapToInterval}
            renderItem={({ item, index }) => (
              <CarouselItemContext.Provider value={{ index }}>
                {item}
              </CarouselItemContext.Provider>
            )}
            getItemLayout={getItemLayout}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            {...flatListProps}
          />
        </CarouselContext.Provider>
        <AnimatePresence>
          {(!hideOverlayOnTap || isOverlayShown) && (
            <View
              key="overlay"
              animation="simple"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
              flex={1}
              pointerEvents="box-none"
            >
              {overlay}
            </View>
          )}
        </AnimatePresence>
      </View>
    </GestureDetector>
  );
});

/**
 * Provides a viewport-sized container for one panel of a Carousel. Also
 * provides an easy way to register an item-specific overlay which is presented
 * outside of and above the scroll content.
 *
 * You can use other view types for the children of Carousel, but you need to
 * make sure their block-axis length matches the length of the Carousel's block
 * axis (e.g. height for a vertical Carousel).
 */
function Item({
  children,
  overlay,
  ...forwardedProps
}: ForwardingProps<
  typeof View,
  {
    children?: React.ReactNode;

    /**
     * If provided, shows the provided element over the scroll viewport when
     * this item is visible.
     */
    overlay?: JSX.Element;
  }
>) {
  const ctxValue = React.useContext(CarouselContext);

  // Show `overlay` in Carousel-managed overlay when this item is visible.
  const index = React.useContext(CarouselItemContext)?.index;
  const isVisible = ctxValue?.visibleIndex === index;
  const reg = ctxValue?.setOverlay;
  React.useEffect(() => {
    if (overlay && isVisible) {
      return reg?.(overlay ?? null);
    }
  }, [reg, overlay, isVisible]);

  return ctxValue == null ? null : (
    <View
      {...(ctxValue?.direction === 'horizontal'
        ? { width: ctxValue.rect?.width }
        : { height: ctxValue.rect?.height })}
      {...forwardedProps}
    >
      {children}
    </View>
  );
}

/**
 * Provides a common layout for a header + footer overlay for a Carousel item.
 */
function Overlay({
  header,
  footer,
}: {
  header?: JSX.Element;
  footer?: JSX.Element;
}) {
  return (
    <>
      {header ? (
        <View position="absolute" top={0} left={0} right={0}>
          {header}
        </View>
      ) : null}
      {footer ? (
        <View position="absolute" bottom={0} left={0} right={0}>
          {footer}
        </View>
      ) : null}
    </>
  );
}

/**
 * Place this inside a `Carousel.Item` for a full-bleed image with pinch-to-zoom.
 */
function ContentImage({
  uri,
  safeAreaEdges,
}: {
  uri: string;
  safeAreaEdges?: Edges;
}) {
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={safeAreaEdges}>
      <ImageZoom style={{ flex: 1 }} resizeMode="contain" uri={uri} />
    </SafeAreaView>
  );
}

export const Carousel = withStaticProperties(_Carousel, {
  Item,
  ContentImage,
  Overlay,
});

export type CarouselRef = React.ElementRef<typeof Carousel>;
