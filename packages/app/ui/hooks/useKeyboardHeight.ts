import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Returns the current on-screen keyboard height in px (0 when hidden).
 *
 * Reads the keyboard state synchronously on mount so consumers position
 * correctly when mounting with the keyboard already visible (e.g. navigating
 * between channels without dismissing the keyboard).
 *
 * `Keyboard.metrics` doesn't exist in react-native-web, so the initial read is
 * guarded; the keyboardDidShow/Hide listeners are no-ops on web, so this
 * simply stays 0 there.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(() => Keyboard.metrics?.()?.height ?? 0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}
