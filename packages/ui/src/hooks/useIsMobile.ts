import { useWindowDimensions } from 'tamagui'

export default function useIsMobile() {
  const { width } = useWindowDimensions();
  return width < 768;
}
