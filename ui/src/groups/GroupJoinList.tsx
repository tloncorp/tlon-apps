import React, { useCallback } from 'react';
import { useGang } from '@/state/groups';
import { useLocation, useNavigate } from 'react-router';
import { getGroupPrivacy } from '@/logic/utils';
import GroupSummary, { GroupSummarySize } from './GroupSummary';

interface GroupJoinItemProps {
  flag: string;
}

function GroupJoinItem({ flag }: GroupJoinItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const gang = useGang(flag);
  const privacy = gang.preview?.cordon
    ? getGroupPrivacy(gang.preview?.cordon)
    : 'public';

  const join = useCallback(() => {
    navigate(`/gangs/${flag}`, { state: { backgroundLocation: location } });
  }, [flag, location, navigate]);

  const reject = useCallback(() => {
    if (privacy === 'public') {
      // TODO: Liam is working on implementing the Reject Gang endpoint
      return;
    }

    navigate(`/gangs/${flag}/reject`, {
      state: { backgroundLocation: location },
    });
  }, [flag, location, navigate, privacy]);

  return (
    <li className="flex items-center justify-between p-2">
      <GroupSummary flag={flag} {...gang.preview} size={'small'} />
      <div className="flex flex-row">
        {gang.invite ? (
          <button className="button bg-red-soft text-red" onClick={reject}>
            Reject
          </button>
        ) : null}
        <button className="button ml-2 bg-blue-soft text-blue" onClick={join}>
          Join
        </button>
      </div>
    </li>
  );
}
interface GroupJoinListProps {
  gangs: string[];
}

interface GroupJoinListProps {
  gangs: string[];
}

export default function GroupJoinList({ gangs }: GroupJoinListProps) {
  return (
    <ul>
      {gangs.map((g) => (
        <GroupJoinItem key={g} flag={g} />
      ))}
    </ul>
  );
}
