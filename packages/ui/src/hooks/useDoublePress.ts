import { useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';

export const useDoublePress = (
  onSinglePress?: (event?: GestureResponderEvent) => void,
  onDoublePress?: (event?: GestureResponderEvent) => void,
  delay = 300
) => {
  const [lastPressTime, setLastPressTime] = useState(0);
  const singlePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return () => {
    const currentTime = Date.now();
    const timeBetweenPresses = currentTime - lastPressTime;

    if (singlePressTimer.current !== null) {
      clearTimeout(singlePressTimer.current);
    }

    if (timeBetweenPresses < delay && timeBetweenPresses > 10) {
      onDoublePress && onDoublePress();
      setLastPressTime(0);
    } else {
      singlePressTimer.current = setTimeout(() => {
        onSinglePress && onSinglePress();
      }, delay);
      setLastPressTime(currentTime);
    }
  };
};
