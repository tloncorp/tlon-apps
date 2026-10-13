import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * Returns the current on-screen keyboard height in px (0 when hidden).
 *
 * Uses the same source as the native composer, including on initial mount.
 * Keyboard Controller's web bindings return 0.
 */
export function useKeyboardHeight() {
  return useKeyboardState((state) => (state.isVisible ? state.height : 0));
}
