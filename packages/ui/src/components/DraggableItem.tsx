import { useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type DraggableItemProps = {
  children: React.ReactNode;
  onDragStart?: () => void;
  onDragEnd: (translateY: number) => void;
  onDrag?: (translateY: number) => void;
};

export function DraggableItem({
  children,
  onDragStart,
  onDragEnd,
  onDrag,
}: DraggableItemProps) {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const context = useRef({ y: 0 });

  const gesture = Gesture.Pan()
    .activeOffsetY([-5, 5]) // to prevent accidental drags
    .onStart(() => {
      context.current.y = translateY.value;
      isDragging.value = true;
      if (onDragStart) {
        runOnJS(onDragStart)();
      }
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
      isDragging.value = false;
    });

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      zIndex: isDragging.value ? 1000 : 1,
      elevation: isDragging.value ? 5 : 0,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyles}>{children}</Animated.View>
    </GestureDetector>
  );
}
