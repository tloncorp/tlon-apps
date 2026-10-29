import { useIsFocused } from '@react-navigation/native';
import { type ComponentRef, type RefObject, useEffect, useState } from 'react';
import { AppState, Dimensions, Platform, type View } from 'react-native';

// List cells can remain mounted outside the viewport. Check before starting any network work.
export function useBrowserPreviewVisible(
  ref: RefObject<ComponentRef<typeof View> | null>,
  enabled: boolean
) {
  const focused = useIsFocused();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled || !focused) {
      setVisible(false);
      return;
    }
    let disposed = false;
    const check = () => {
      if (
        AppState.currentState !== 'active' ||
        (Platform.OS === 'web' && document.visibilityState !== 'visible')
      ) {
        setVisible(false);
        return;
      }
      const { width: screenWidth, height: screenHeight } =
        Dimensions.get('window');
      ref.current?.measureInWindow((x, y, width, height) => {
        if (!disposed)
          setVisible(
            width > 0 &&
              height > 0 &&
              x < screenWidth &&
              y < screenHeight &&
              x + width > 0 &&
              y + height > 0
          );
      });
    };
    check();
    const timer = setInterval(check, 1000);
    const subscription = AppState.addEventListener('change', check);
    if (Platform.OS === 'web')
      document.addEventListener('visibilitychange', check);
    return () => {
      disposed = true;
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === 'web')
        document.removeEventListener('visibilitychange', check);
    };
  }, [enabled, focused, ref]);
  return enabled && focused && visible;
}
