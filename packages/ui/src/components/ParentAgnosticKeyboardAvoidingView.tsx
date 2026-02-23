import * as React from 'react';
import {
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

/**
 * React Native's `KeyboardAvoidingView` does not work when its parent has a
 * vertical offset within the screen (causes content to show below keyboard).
 * This component works in those cases, but is more likely to have timing
 * issues (since it uses async `measure` instead of `onLayout`).
 *
 */
export function ParentAgnosticKeyboardAvoidingView({
  children,
  contentContainerStyle,
  ...passedProps
}: Omit<ViewProps, 'ref' | 'onLayout' | 'style'> & {
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const containerRef = React.useRef<React.ElementRef<typeof View>>(null);
  const [keyboardFrame, setKeyboardFrame] = React.useState<{
    screenY: number;
  } | null>(null);
  const keyboardAnimationDurationRef = React.useRef<number | null>(null);
  const [containerFrame, setContainerFrame] = React.useState<{
    pageY: number;
    height: number;
  } | null>(null);

  const measure = React.useCallback(() => {
    containerRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
      setContainerFrame({ pageY, height });
    });
  }, []);

  React.useEffect(() => {
    const handleKeyboardEvent = (event: KeyboardEvent) => {
      keyboardAnimationDurationRef.current = event.duration ?? (Platform.OS === 'android' ? 250 : null);
      measure();
      setKeyboardFrame(event.endCoordinates);
    };

    const handleKeyboardHide = () => {
      keyboardAnimationDurationRef.current = Platform.OS === 'android' ? 250 : null;
      measure();
      setKeyboardFrame(null);
    };

    if (Platform.OS === 'android') {
      const showSub = Keyboard.addListener('keyboardDidShow', handleKeyboardEvent);
      const hideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }

    const frameSub = Keyboard.addListener('keyboardWillChangeFrame', handleKeyboardEvent);
    return () => frameSub.remove();
  }, [measure]);

  const adjustmentPaddingBottom = React.useMemo(() => {
    if (keyboardFrame == null || containerFrame == null) {
      return 0;
    }
    return containerFrame.pageY + containerFrame.height - keyboardFrame.screenY;
  }, [keyboardFrame, containerFrame]);

  // Why `useLayoutEffect`?
  // Using `useEffect` here causes animation to fail - likely because
  // `useEffect` is not guaranteed to run before applying the layout, causing
  // `configureNext` to fire after changing padding.
  React.useLayoutEffect(() => {
    const duration = keyboardAnimationDurationRef.current;
    if (duration == null) {
      return;
    }
    LayoutAnimation.configureNext({
      // We have to pass the duration equal to minimal accepted duration defined here: RCTLayoutAnimation.m
      duration: duration > 10 ? duration : 10,
      update: {
        duration: duration > 10 ? duration : 10,
        type: 'keyboard',
      },
    });
  }, [adjustmentPaddingBottom]);

  const combinedStyle = React.useMemo(() => {
    return [
      contentContainerStyle,
      {
        paddingBottom: adjustmentPaddingBottom,
      },
    ];
  }, [contentContainerStyle, adjustmentPaddingBottom]);

  return (
    <View {...passedProps} style={combinedStyle} ref={containerRef}>
      {children}
    </View>
  );
}
