import React, { useCallback } from 'react';
import { useGang } from '@/state/groups';
import { useLocation, useNavigate } from 'react-router';
import GroupSummary, { GroupSummarySize } from './GroupSummary';
import { getGroupPrivacy } from '@/logic/utils';

interface GroupJoinItemProps {
  flag: string;
}

function GroupJoinItem({ flag }: GroupJoinItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const gang = useGang(flag);
  const privacy = gang.preview?.cordon ? getGroupPrivacy(gang.preview?.cordon) : 'public';

  const join = useCallback(() => {
    navigate(`/gangs/${flag}`, { state: { backgroundLocation: location } });
  }, [flag]);

  const reject = useCallback(() => {
    if(privacy === 'public') {
      // TODO: Liam is working on implementing the Reject Gang endpoint
      return;
    }

    navigate(`/gangs/${flag}/reject`, { state: { backgroundLocation: location } });    
  }, [flag]);

  return (
    <li className="flex items-center p-2 justify-between">
      <GroupSummary flag={flag} {...gang.preview} size={'small'} />
      <div className='flex flex-row'>
        <button
          className="button bg-red-soft text-red"
          onClick={reject}
        >
          Reject
        </button>
        <button
          className="button bg-blue-soft text-blue ml-2"
          onClick={join}
        >
          Join
        </button>
      </div>
    </li>
  );
}
interface GroupJoinListProps {
  gangs: string[];
  size?: GroupSummarySize;
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
