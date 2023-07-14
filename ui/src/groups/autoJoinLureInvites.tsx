import cookies from 'browser-cookies';
import { Gangs } from '@/types/groups';
import {
  useGroupJoinMutation,
} from '@/state/groups';

export default function useAutoJoinLureInvites() {
  const { mutate: joinMutation } = useGroupJoinMutation();

  return function (pendingGangs: Gangs) {
    Object.entries(pendingGangs).map(function([flag, _]) {
      if (cookies.get(`lure-join-${flag}`.replace('/', '--'))) {
        joinMutation({flag})
      }
    })
  }
}
