import useGroupJoin from '@/groups/useGroupJoin';
import cookies from 'browser-cookies';
import { Gangs } from '@/types/groups';

export default function useAutoJoinLureInvites() {
  return function (pendingGangs: Gangs) {
    Object.entries(pendingGangs).map(function([flag, g]) {
      if (cookies.get(`lure-join-${flag}`.replace('/', '--'))) {
        const { join } = useGroupJoin(flag, g, false);
        
        join();
      }
    })
  }
}
