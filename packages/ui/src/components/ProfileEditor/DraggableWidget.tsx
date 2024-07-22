import { useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { View } from '../../core';
import { GridMeasure, WidgetPosition } from './types';

export default function DraggableWidget({
  measure,
  position,
  component,
}: {
  measure: GridMeasure;
  position: WidgetPosition;
  component: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ row: 0, col: 0 });

  const pressed = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const translateX = useSharedValue(
    measure.x + position.colStart * measure.cellSize
  );
  const translateY = useSharedValue(
    measure.y + position.rowStart * measure.cellSize
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      pressed.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onChange((event) => {
      const potentialTranslateX = startX.value + event.translationX;
      const potentialTranslateY = startY.value + event.translationY;

      const maxX = (measure.numCols - position.numCols) * measure.cellSize;
      const maxY = (measure.numRows - position.numRows) * measure.cellSize;

      translateX.value = Math.min(Math.max(potentialTranslateX, 0), maxX);
      translateY.value = Math.min(Math.max(potentialTranslateY, 0), maxY);
    })
    .onFinalize(() => {
      pressed.value = false;
      try {
        const cellIndexX = Math.round(translateX.value / measure.cellSize);
        translateX.value = cellIndexX * measure.cellSize;

        const cellIndexY = Math.round(translateY.value / measure.cellSize);
        translateY.value = cellIndexY * measure.cellSize;
      } catch (e) {
        console.log(e);
      }
    });

  useAnimatedReaction(
    () => {
      try {
        return {
          row: Math.round(translateY.value / measure.cellSize),
          col: Math.round(translateX.value / measure.cellSize),
          dragging: pressed.value,
        };
      } catch (e) {
        return { row: 0, col: 0 };
      }
    },
    (current, previous) => {
      try {
        if (current.row !== previous?.row || current.col !== previous?.col) {
          runOnJS(setPreviewPosition)(current);
        }
        runOnJS(setDragging)(current.dragging ?? false);
      } catch (e) {
        console.log('err 2');
      }
    }
  );

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: pressed.value ? 1.1 : 1 },
    ],
  }));

  return (
    <>
      <View
        position="absolute"
        borderColor="$color.green"
        borderWidth={4}
        display={dragging ? 'flex' : 'none'}
        top={previewPosition.row * measure.cellSize}
        left={previewPosition.col * measure.cellSize}
        height={position.numRows * measure.cellSize - measure.borderWidth * 2}
        width={position.numCols * measure.cellSize - measure.borderWidth * 2}
      />
      <GestureDetector gesture={pan}>
        <Animated.View style={animatedStyles}>
          <View
            position="absolute"
            justifyContent="center"
            alignItems="center"
            top={position.rowStart * measure.cellSize}
            left={position.colStart * measure.cellSize}
            height={
              position.numRows * measure.cellSize - measure.borderWidth * 2
            }
            width={
              position.numCols * measure.cellSize - measure.borderWidth * 2
            }
          >
            {component}
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
