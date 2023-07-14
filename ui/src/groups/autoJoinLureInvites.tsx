import cookies from 'browser-cookies';
import { Gangs } from '@/types/groups';
import {
  useGroupJoinMutation,
} from '@/state/groups';
import useNavigateByApp from '@/logic/useNavigateByApp';

export default function useAutoJoinLureInvites() {
  const { mutateAsync: joinMutation } = useGroupJoinMutation();
  const navigateByApp = useNavigateByApp();

  return function (pendingGangs: Gangs) {
    Object.entries(pendingGangs).map(async ([flag, gang]) => {
      const cookieName = `lure-join-${flag}`.replace('/', '--');

      if (!gang.claim) {
        if (cookies.get(cookieName)) {
          await joinMutation({flag});
          cookies.erase(cookieName)
          return navigateByApp(`/groups/${flag}`);
        }
      }
    })
  }
}
