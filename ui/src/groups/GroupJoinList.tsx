import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useGang, useGroup, useGroupState } from '@/state/groups';
import GroupSummary, { GroupSummarySize } from './GroupSummary';

interface GroupJoinItemProps {
  flag: string;
  size?: GroupSummarySize;
}

function GroupJoinItem({ flag, size }: GroupJoinItemProps) {
  const navigate = useNavigate();
  const gang = useGang(flag);
  const group = useGroup(flag);

  const join = useCallback(() => {
    if (group) {
      return navigate(`/groups/${flag}`);
    }

    return useGroupState.getState().join(flag, true);
  }, [flag, group, navigate]);

  return (
    <li className="flex items-center p-2">
      <GroupSummary flag={flag} {...gang.preview} size={size} />
      <button
        className="button ml-auto bg-blue-soft text-blue dark:bg-blue-900"
        onClick={join}
      >
        {group ? 'Open' : 'Join'}
      </button>
    </li>
  );
}
interface GroupJoinListProps {
  gangs: string[];
  size?: GroupSummarySize;
}

export default function GroupJoinList({ gangs, size }: GroupJoinListProps) {
  return (
    <ul>
      {gangs.map((g) => (
        <GroupJoinItem key={g} flag={g} size={size} />
      ))}
    </ul>
  );
}
