import React, { useEffect } from 'react';
import useGroupJoin from '@/groups/useGroupJoin';
import { useGang, useGroupState } from '@/state/groups';
import GroupAvatar from '@/groups/GroupAvatar';
import {
  getFlagParts,
  matchesBans,
  pluralRank,
  toTitleCase,
} from '@/logic/utils';
import ShipName from '@/components/ShipName';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

interface GroupReferenceProps {
  flag: string;
  isScrolling?: boolean;
}

export default function GroupReference({
  flag,
  isScrolling = false,
}: GroupReferenceProps) {
  const gang = useGang(flag);
  const { group, privacy, open, reject, button, status } = useGroupJoin(
    flag,
    gang
  );
  const { ship } = getFlagParts(flag);
  const cordon = gang.preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;

  const meta = group?.meta || gang?.preview?.meta;

  useEffect(() => {
    if (!gang?.preview && !group && !isScrolling) {
      useGroupState.getState().search(flag);
    }
  }, [gang, group, flag, isScrolling]);

  if (privacy === 'secret') {
    return (
      <div className="relative flex h-16 items-center space-x-3 rounded-lg border-2 border-gray-50 bg-gray-50 p-2 text-base font-semibold text-gray-600">
        <ExclamationPoint className="h-8 w-8 text-gray-400" />
        <span>This content is unavailable to you</span>
      </div>
    );
  }

  return (
    <div className="not-prose relative flex items-center rounded-lg border-2 border-gray-50 text-base transition-colors hover:border-gray-100 hover:bg-white group-one-hover:border-gray-100 group-one-hover:bg-white">
      <button
        className="flex w-full items-center justify-start rounded-lg p-2 text-left"
        onClick={open}
      >
        <div className="flex items-center space-x-3 font-semibold">
          <GroupAvatar {...meta} size="h-12 w-12" />
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <h3>{meta?.title || flag}</h3>
              <span className="font-semibold text-gray-400">
                by <ShipName name={ship} />
              </span>
            </div>
            <span className="capitalize text-gray-400">Group • {privacy}</span>
          </div>
        </div>
      </button>
      <div className="absolute right-5 flex flex-row">
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
                className="small-button bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject
              </button>
            ) : null}
            {status === 'loading' ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Joining...</span>
                <LoadingSpinner />
              </div>
            ) : (
              <button
                className="small-button ml-2 bg-blue text-white dark:text-black"
                onClick={button.action}
                disabled={button.disabled || status === 'error'}
              >
                {status === 'error' ? 'Errored' : button.text}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
