import { useIsWindowNarrow, useWindowSafeAreaInsets } from '@tloncorp/ui';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

export function useInputPopupSideOffsets() {
  const insets = useWindowSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const pane = useSafeAreaFrame();
  const { width } = useWindowDimensions();
  if (isWindowNarrow) {
    return { left: insets.left, right: insets.right };
  }
  // react-native-safe-area-context reports a nested provider's frame relative
  // to its screen's view controller, so only its width is usable here. The
  // composer's pane is the split layout's detail pane, on the right edge.
  return {
    left: Math.max(insets.left, width - pane.width),
    right: insets.right,
  };
}
