import { useNavigate } from 'react-router';
import useAppName from './useAppName';

export default function useNavigateByApp() {
  const { origin } = window.location;
  const navigate = useNavigate();
  const app = useAppName();

  const navFn = (path: string) => {
    const isGroupsPath =
      path.startsWith('/groups') ||
      path.startsWith('/find') ||
      path.startsWith('/gangs');
    const isTalkPath = path.startsWith('/dm');

    if (app === 'Talk') {
      if (isGroupsPath) {
        const href = `${origin}/apps/groups${path}`;
        return window.open(href, '_blank');
      }
      return navigate(path);
    }

    if (app === 'Groups') {
      if (isTalkPath) {
        const href = `${origin}/apps/talk${path}`;
        return window.open(href, '_blank');
      }
      return navigate(path);
    }

    return navigate(path);
  };

  return navFn;
}
