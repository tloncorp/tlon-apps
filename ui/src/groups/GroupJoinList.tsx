import { useGang, useGangList, useGroupState } from '@/state/groups';
import React, { useCallback } from 'react';
import GroupSummary from './GroupSummary';

interface GroupJoinItemProps {
  flag: string;
}

function GroupJoinItem({ flag }: GroupJoinItemProps) {
  const gang = useGang(flag);

  const join = useCallback(() => {
    useGroupState.getState().join(flag, true);
  }, [flag]);

  return (
    <li className="flex items-center p-2">
      <GroupSummary flag={flag} {...gang.preview} />
      <button
        className="button ml-auto bg-blue text-white dark:text-black"
        onClick={join}
      >
        Join
      </button>
    </li>
  );
}

export default function GroupJoinList() {
  const gangs = useGangList();

  return (
    <ul>
      {gangs.map((g) => (
        <GroupJoinItem flag={g} />
      ))}
    </ul>
  );
}
