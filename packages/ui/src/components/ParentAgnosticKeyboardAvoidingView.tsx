import * as React from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

/**
 * React Native's `KeyboardAvoidingView` can misbehave when its parent has a
 * vertical offset within the screen (content can end up below keyboard).
 *
 * This component uses measurement-based padding on iOS to handle that case.
 * On Android we rely on native window resizing/insets (`adjustResize`) and do
 * not apply JS-driven keyboard layout adjustments.
 */
export function ParentAgnosticKeyboardAvoidingView({
  children,
  contentContainerStyle,
  ...passedProps
}: Omit<ViewProps, 'ref' | 'onLayout' | 'style'> & {
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  if (Platform.OS === 'android') {
    return (
      <View {...passedProps} style={contentContainerStyle}>
        {children}
      </View>
    );
  }

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
    const sub = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      keyboardAnimationDurationRef.current = event.duration;
      measure();
      setKeyboardFrame(event.endCoordinates);
    });
    return () => sub.remove();
  }, [measure]);

  const adjustmentPaddingBottom = React.useMemo(() => {
    if (keyboardFrame == null || containerFrame == null) {
      return 0;
    }
    return containerFrame.pageY + containerFrame.height - keyboardFrame.screenY;
  }, [keyboardFrame, containerFrame]);

  React.useLayoutEffect(() => {
    const duration = keyboardAnimationDurationRef.current;
    if (duration == null) {
      return;
    }
    LayoutAnimation.configureNext({
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
