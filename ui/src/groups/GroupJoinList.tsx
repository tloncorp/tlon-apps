import React, { useCallback } from 'react';
import { useGang } from '@/state/groups';
import { useLocation, useNavigate } from 'react-router';
import GroupSummary, { GroupSummarySize } from './GroupSummary';

interface GroupJoinItemProps {
  flag: string;
  size?: GroupSummarySize;
}

function GroupJoinItem({ flag }: GroupJoinItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const gang = useGang(flag);

  const join = useCallback(() => {
    navigate(`/gangs/${flag}`, { state: { backgroundLocation: location } });
  }, [flag]);

  const reject = useCallback(() => {
    // TODO: Liam is working on implementing the Reject Gang endpoint
    console.log('reject ...');
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
        <GroupJoinItem key={g} flag={g} size={'small'} />
      ))}
    </ul>
  );
}
