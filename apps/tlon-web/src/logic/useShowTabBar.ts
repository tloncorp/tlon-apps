import { useIsMobile } from './useMedia';

export default function useShowTabBar() {
  const isMobile = useIsMobile();
  return isMobile && !window.nativeOptions?.hideTabBar;
}
