import { MobileNavTab } from '../types/native';

export function parseActiveTab(pathname: string): MobileNavTab | null {
  const parsedPath = trimFullPath(pathname);
  const isActive = (path: string) => parsedPath.startsWith(path);

  if (isActive('/groups')) {
    return 'Groups';
  }

  if (isActive('/messages') || isActive('/dm')) {
    return 'Messages';
  }

  if (isActive('/profile')) {
    return 'Profile';
  }

  if (isActive('/notifications')) {
    return 'Activity';
  }

  return null;
}

export function trimFullPath(path: string): string {
  return path.startsWith('/apps/groups') ? path.slice(12) : path;
}
