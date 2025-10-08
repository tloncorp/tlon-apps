import { DEFAULT_KEYBOARD_OFFSET } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EmitterSubscription,
  Keyboard,
  LayoutChangeEvent,
  ScrollView,
} from 'react-native';

interface UseKeyboardAwareScrollOptions {
  /** Custom offset when scrolling to input (default: 60) */
  scrollOffset?: number;
  /** Whether to enable auto-scrolling (default: true) */
  enabled?: boolean;
}

interface UseKeyboardAwareScrollReturn {
  /** Ref to attach to ScrollView */
  scrollViewRef: React.RefObject<ScrollView>;
  /** Current keyboard height (0 when hidden) */
  keyboardHeight: number;
  /** Call this on input focus with the input's Y position */
  handleInputFocus: (inputY: number) => void;
  /** Register an input's layout - returns onLayout handler */
  registerInputLayout: (inputId: string) => (event: LayoutChangeEvent) => void;
  /** Get registered input position by ID */
  getInputPosition: (inputId: string) => number | undefined;
}

/**
 * Hook to handle keyboard-aware scrolling for forms with multiple inputs.
 * Automatically scrolls to focused inputs when keyboard appears.
 *
 * @example
 * ```tsx
 * const { scrollViewRef, keyboardHeight, handleInputFocus, registerInputLayout } = useKeyboardAwareScroll();
 *
 * return (
 *   <ScrollView ref={scrollViewRef}>
 *     <View onLayout={registerInputLayout('input1')}>
 *       <TextInput onFocus={() => handleInputFocus(getInputPosition('input1'))} />
 *     </View>
 *   </ScrollView>
 * );
 * ```
 */
export function useKeyboardAwareScroll({
  scrollOffset = DEFAULT_KEYBOARD_OFFSET,
  enabled = true,
}: UseKeyboardAwareScrollOptions = {}): UseKeyboardAwareScrollReturn {
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardListenerRef = useRef<EmitterSubscription | null>(null);
  const inputPositions = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (keyboardListenerRef.current) {
        keyboardListenerRef.current.remove();
      }
    };
  }, []);

  const registerInputLayout = useCallback((inputId: string) => {
    return (event: LayoutChangeEvent) => {
      inputPositions.current.set(inputId, event.nativeEvent.layout.y);
    };
  }, []);

  const getInputPosition = useCallback((inputId: string) => {
    return inputPositions.current.get(inputId);
  }, []);

  const handleInputFocus = useCallback(
    (inputY: number) => {
      if (!enabled || !scrollViewRef.current) return;

      if (keyboardListenerRef.current) {
        keyboardListenerRef.current.remove();
      }

      keyboardListenerRef.current = Keyboard.addListener(
        'keyboardDidShow',
        () => {
          if (scrollViewRef.current) {
            const scrollTo = Math.max(0, inputY - scrollOffset);

            scrollViewRef.current.scrollTo({
              y: scrollTo,
              animated: true,
            });
          }

          if (keyboardListenerRef.current) {
            keyboardListenerRef.current.remove();
            keyboardListenerRef.current = null;
          }
        }
      );
    },
    [enabled, scrollOffset]
  );

  return {
    scrollViewRef,
    keyboardHeight,
    handleInputFocus,
    registerInputLayout,
    getInputPosition,
  };
}
