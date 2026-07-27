import { FloatingActionButton } from '@tloncorp/ui';
import Animated from 'react-native-reanimated';

import type { ScrollToBottomButtonChromeProps } from './ScrollToBottomButtonChrome.types';
import { useScrollToBottomButtonTransition } from './useScrollToBottomButtonTransition';

export function ScrollToBottomButtonChrome({
  children,
  onPress,
  visible,
}: ScrollToBottomButtonChromeProps) {
  const { animatedStyle } = useScrollToBottomButtonTransition(visible);

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={animatedStyle}
    >
      <FloatingActionButton icon={children} onPress={onPress} />
    </Animated.View>
  );
}
