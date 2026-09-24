import { useMemo } from 'react';
import { isWeb, useWindowDimensions } from 'tamagui';

// Native always renders RootStack, never the desktop navigator the wide branches assume.
export default function useIsWindowNarrow() {
  const { width } = useWindowDimensions();
  const isNarrow = useMemo(() => !isWeb || width < 768, [width]);
  return isNarrow;
}
