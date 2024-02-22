import cookies from 'browser-cookies';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';

import { getPrivacyFromGang } from '@/logic/utils';
import {
  useGroupJoinMutation,
  usePendingGangsWithoutClaim,
} from '@/state/groups';
import { Gangs } from '@/types/groups';

export default function LureAutojoiner(): React.ReactElement {
  const { mutateAsync: joinMutation } = useGroupJoinMutation();
  const navigate = useNavigate();

  const pendingGangsWithoutClaim = usePendingGangsWithoutClaim();

  const autojoin = useCallback(
    (pendingGangs: Gangs) => {
      Object.entries(pendingGangs).map(async ([flag, gang]) => {
        const privacy = getPrivacyFromGang(gang);
        const cookieName = `lure-join-${flag}`.replace('/', '--');

        if (!gang.claim) {
          if (cookies.get(cookieName)) {
            await joinMutation({ flag, privacy });
            cookies.erase(cookieName);
            navigate(`/groups/${flag}`);
          }
        }
      });
    },
    [joinMutation, navigate]
  );

  useEffect(() => {
    if (Object.keys(pendingGangsWithoutClaim).length) {
      autojoin(pendingGangsWithoutClaim);
    }
  }, [pendingGangsWithoutClaim, autojoin]);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <></>;
}
