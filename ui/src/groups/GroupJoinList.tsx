import React, { useState, useCallback } from 'react';
import { Gang, Gangs } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import GroupSummary from './GroupSummary';
import useGroupJoin from './useGroupJoin';

interface GroupJoinItemProps {
  flag: string;
  gang: Gang;
}

function GroupJoinItem({ flag, gang }: GroupJoinItemProps) {
  const [hasBeenClicked, setHasBeenClicked] = useState(false);
  const { open, reject, button, privacy, requested } = useGroupJoin(flag, gang);

  const onClick = useCallback((buttonAction: () => void) => {
    setHasBeenClicked(true);
    buttonAction();
  }, []);

  return (
    <li className="relative flex items-center">
      <button
        className="flex w-full items-center justify-start rounded-xl p-2 text-left hover:bg-gray-50"
        onClick={open}
      >
        <GroupSummary flag={flag} {...gang.preview} size={'small'} />
      </button>
      <div className="absolute right-2 flex flex-row">
        {gang.invite ? (
          <button
            className="button bg-red-soft text-red mix-blend-multiply dark:bg-red-900 dark:mix-blend-screen"
            onClick={reject}
          >
            Reject
          </button>
        ) : null}
        <button
          className="button ml-2 bg-blue-soft text-blue mix-blend-multiply disabled:bg-gray-100 dark:bg-blue-900 dark:mix-blend-screen dark:disabled:bg-gray-100"
          onClick={() => onClick(button.action)}
          disabled={button.disabled}
        >
          {hasBeenClicked && privacy === 'private' && !requested ? (
            <LoadingSpinner />
          ) : (
            button.text
          )}
        </button>
      </div>
    </li>
  );
}

interface GroupJoinListProps {
  gangs: Gangs;
}

export default function GroupJoinList({ gangs }: GroupJoinListProps) {
  const gangEntries = Object.entries(gangs);

  return (
    <ul>
      {gangEntries.map(([flag, gang]) => (
        <GroupJoinItem key={flag} flag={flag} gang={gang} />
      ))}
    </ul>
  );
}
