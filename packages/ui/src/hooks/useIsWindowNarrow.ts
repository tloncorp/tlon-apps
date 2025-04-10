import { useMemo } from 'react';
import { useWindowDimensions } from 'tamagui';

export default function useIsWindowNarrow() {
  const { width } = useWindowDimensions();
  const isNarrow = useMemo(() => width < 768, [width]);
  return isNarrow;
}
