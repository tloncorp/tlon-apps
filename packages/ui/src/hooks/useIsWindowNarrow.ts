import { useWindowDimensions } from 'tamagui'

export default function useIsWindowNarrow() {
  const { width } = useWindowDimensions();
  return width < 768;
}
