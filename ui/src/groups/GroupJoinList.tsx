import React from 'react';
import cn from 'classnames';
import { useIsMobile } from '@/logic/useMedia';
import { Gang, Gangs } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { matchesBans, pluralRank, toTitleCase } from '@/logic/utils';
import GroupSummary from './GroupSummary';
import useGroupJoin from './useGroupJoin';

interface GroupJoinItemProps {
  flag: string;
  gang: Gang;
}

function GroupJoinItem({ flag, gang }: GroupJoinItemProps) {
  const { open, reject, button, status, group } = useGroupJoin(flag, gang);
  const isMobile = useIsMobile();
  const cordon = gang.preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;

  return (
    <li className="relative flex items-center">
      <button
        className={cn(
          'flex w-full items-center justify-start rounded-xl p-2 text-left hover:bg-gray-50',
          isMobile && 'bg-gray-50'
        )}
        onClick={open}
      >
        <GroupSummary flag={flag} preview={gang.preview} size={'small'} />
      </button>
      <div className="absolute right-2 flex flex-row">
        {banned ? (
          <span className="inline-block px-2 font-semibold text-gray-600">
            {banned === 'ship'
              ? "You've been banned from this group"
              : `${toTitleCase(pluralRank(banned))} are banned`}
          </span>
        ) : (
          <>
            {gang.invite && status !== 'loading' ? (
              <button
                className="button bg-red-soft text-red mix-blend-multiply dark:bg-red-900 dark:mix-blend-screen"
                onClick={reject}
              >
                Reject
              </button>
            ) : null}
            {status === 'loading' ? (
              <div className="flex items-center justify-center space-x-2">
                <span className="text-gray-400"> Joining... </span>
                <LoadingSpinner className="h-4 w-4" />
              </div>
            ) : (
              <button
                className="button ml-2 bg-blue-soft text-blue mix-blend-multiply disabled:bg-gray-100 dark:bg-blue-900 dark:mix-blend-screen dark:disabled:bg-gray-100"
                onClick={button.action}
                disabled={button.disabled || status === 'error'}
              >
                {status === 'error' ? 'Errored' : button.text}
              </button>
            )}
          </>
        )}
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
