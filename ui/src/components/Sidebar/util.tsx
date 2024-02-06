import { useLocation } from 'react-router';

export type ActiveTab =
  | 'messages'
  | 'notifications'
  | 'groups'
  | 'profile'
  | 'other';
export default function useActiveTab(): ActiveTab {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  if (isActive('/groups')) {
    return 'groups';
  }

  if (isActive('/messages') || isActive('/dm')) {
    return 'messages';
  }

  if (isActive('/notifications') || location.pathname === '/') {
    return 'notifications';
  }

  if (isActive('/profile')) {
    return 'profile';
  }

  return 'other';
}
