import { useLocation } from 'react-router';

export type ActiveTab = 'messages' | 'notifications' | 'groups' | 'other';
export default function useActiveTab(): ActiveTab {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  if (location.pathname === '/') {
    return 'groups';
  }

  if (isActive('/messages') || isActive('/dm')) {
    return 'messages';
  }

  if (isActive('/notifications')) {
    return 'notifications';
  }

  return 'other';
}
