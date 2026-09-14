import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

export function useInputPopupBottomOffset(
  containerHeight: number,
  inputBarHeight?: number
) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const effectiveBottomInset =
    keyboardHeight > 0 ? keyboardHeight : insets.bottom;

  return {
    bottomOffset: effectiveBottomInset + containerHeight + 24,
    // Leave the whole multiline composer tappable below the portal backdrop.
    backdropBottom: effectiveBottomInset + (inputBarHeight ?? containerHeight),
  };
}
