import { useCallback, useRef } from 'react';
import { LayoutRectangle, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type DraggableItemProps = {
  children: React.ReactNode;
  onDragStart: (layout: LayoutRectangle) => void;
  onDragEnd: (translateY: number) => void;
  onDrag: (translateY: number) => void;
  zIndex?: number;
};

export function DraggableItem({
  children,
  onDragStart,
  onDragEnd,
  onDrag,
}: DraggableItemProps) {
  const translateY = useSharedValue(0);
  const context = useRef({ y: 0 });
  const viewRef = useRef<View>(null);

  const measureView = useCallback(() => {
    return new Promise<LayoutRectangle>((resolve) => {
      if (viewRef.current) {
        viewRef.current.measure((x, y, width, height, pageX, pageY) => {
          resolve({ x: pageX, y: pageY, width, height });
        });
      } else {
        resolve({ x: 0, y: 0, width: 0, height: 0 });
      }
    });
  }, []);

  const handleDragStart = useCallback(async () => {
    const layout = await measureView();
    console.log('Drag started, measured layout:', layout);
    if (onDragStart) {
      onDragStart(layout);
    }
  }, [onDragStart, measureView]);

  const gesture = Gesture.Pan()
    .activeOffsetY([-5, 5]) // to prevent accidental drags
    .onStart(() => {
      context.current.y = translateY.value;
      runOnJS(handleDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY + context.current.y;
      if (onDrag) {
        runOnJS(onDrag)(translateY.value);
      }
    })
    .onEnd(() => {
      runOnJS(onDragEnd)(translateY.value);
      translateY.value = withSpring(0);
    });

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      width: '100%',
    };
  });

  return (
    <View ref={viewRef} style={{ width: '100%' }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyles}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
