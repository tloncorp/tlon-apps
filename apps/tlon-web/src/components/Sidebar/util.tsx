import { useCallback } from 'react';
import { NavigateOptions, To, useLocation, useNavigate } from 'react-router';

import { useNavState, usePutEntryMutation } from '@/state/settings';

export type ActiveTab =
  | 'messages'
  | 'notifications'
  | 'groups'
  | 'profile'
  | 'other';
export default function useActiveTab(): ActiveTab {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  if (isActive('/groups') || location.pathname === '/') {
    return 'groups';
  }

  if (isActive('/messages') || isActive('/dm')) {
    return 'messages';
  }

  if (isActive('/notifications')) {
    return 'notifications';
  }

  if (isActive('/profile')) {
    return 'profile';
  }

  return 'other';
}

export function useNavToTab() {
  const navState = useNavState();
  const navigate = useNavigate();

  return useCallback(
    (tab: 'messages' | 'groups') => {
      if (tab === 'groups') {
        navigate(navState.groups || '/groups');
      }

      if (tab === 'messages') {
        navigate(navState.messages || '/messages');
      }
    },
    [navState, navigate]
  );
}

export function getTabPath(ogPath: string, locationPath: string) {
  const isActive = (path: string) => locationPath.startsWith(path);

  let path = ogPath;
  const groupsOnly =
    path.includes('channels/diary') || path.includes('channels/heap');
  if (isActive('/groups') || location.pathname === '/') {
    path = path.replace(/^\/dm/, '');
  }

  if ((isActive('/messages') || isActive('/dm')) && !groupsOnly) {
    path = path.replace(/^\/groups/, '/dm/groups');
  }

  return path;
}

export function useNavWithinTab() {
  const location = useLocation();
  const navigate = useNavigate();

  const navTo = useCallback(
    (to: number | To, modal = false, options?: NavigateOptions) => {
      const opts = modal
        ? {
            ...options,
            state: {
              ...(options?.state ?? location.state),
              backgroundLocation: location,
            },
          }
        : options;

      if (typeof to === 'number') {
        navigate(to);
        return;
      }

      const isStringPath = typeof to === 'string';
      const path = getTabPath(
        isStringPath ? to : to.pathname || '',
        location.pathname
      );

      navigate(
        !isStringPath
          ? {
              ...to,
              pathname: path,
            }
          : path,
        opts
      );
    },
    [location, navigate]
  );

  return {
    navigate: navTo,
  };
}

export function useSaveNavState() {
  const { mutate: mutateMessages } = usePutEntryMutation({
    bucket: 'groups',
    key: 'messagesNavState',
  });

  const { mutate: mutateGroups } = usePutEntryMutation({
    bucket: 'groups',
    key: 'groupsNavState',
  });

  return useCallback(
    (tab: ActiveTab, path: string) => {
      if (tab === 'groups') {
        mutateGroups({ val: path });
      }

      if (tab === 'messages') {
        mutateMessages({ val: path });
      }
    },
    [mutateGroups, mutateMessages]
  );
}
