import { unreadChannelsQuery } from './queries';
import { useObject, useQuery } from './realm';
import type { Contact } from './schemas';

// Model hooks
export function useContact(id: string): Contact | null {
  return useObject('Contact', id);
}

export function useUnreadChannelsCount(): {
  total: number;
  groups: number;
  dms: number;
} {
  const groupUnreads = useQuery('Unread', unreadChannelsQuery('channel'));
  const dmUnreads = useQuery('Unread', unreadChannelsQuery('dm'));

  return {
    total: groupUnreads.length + dmUnreads.length,
    groups: groupUnreads.length,
    dms: dmUnreads.length,
  };
}
