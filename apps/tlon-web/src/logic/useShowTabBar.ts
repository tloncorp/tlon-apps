import { useSearchParams } from 'react-router-dom';

import { useIsMobile } from './useMedia';

export default function useShowTabBar() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const isEditing = !!searchParams.get('edit');
  return isMobile && !window.nativeOptions?.hideTabBar && !isEditing;
}
