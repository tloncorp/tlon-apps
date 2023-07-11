import { Gangs } from '@/types/groups'
import useGroupJoin from '@/groups/useGroupJoin';
import cookies from 'browser-cookies';

export default function AutoJoinLureInvites(pendingGangs: Gangs) {
  Object.entries(pendingGangs).map(function([flag, g]) {
    if (cookies.get(`lure-join-${flag}`)) {
      useGroupJoin(flag, g);
    }

    return null;
  })
}
