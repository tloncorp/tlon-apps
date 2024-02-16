import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

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
