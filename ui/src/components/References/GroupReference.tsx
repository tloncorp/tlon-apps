import React, { useEffect } from 'react';
import useGroupJoin from '@/groups/useGroupJoin';
import { useGang, useGroupState } from '@/state/groups';
import GroupAvatar from '@/groups/GroupAvatar';
import { getFlagParts } from '@/logic/utils';
import ShipName from '@/components/ShipName';
import ExclamationPoint from '@/components/icons/ExclamationPoint';

interface GroupReferenceProps {
  flag: string;
}

export default function GroupReference({ flag }: GroupReferenceProps) {
  const gang = useGang(flag);
  const { group, privacy, open, join, reject, requested } = useGroupJoin(
    flag,
    gang
  );
  const { ship } = getFlagParts(flag);

  const meta = group?.meta || gang?.preview?.meta;

  useEffect(() => {
    if (!gang?.preview && !group) {
      useGroupState.getState().search(flag);
    }
  }, [gang, group, flag]);

  const buttonMessage = () => {
    if (group) {
      return 'Go';
    }
    if (requested) {
      return 'Join Requested';
    }
    if (privacy === 'private') {
      return 'Request to Join';
    }
    return 'Join';
  };

  if (privacy === 'secret') {
    return (
      <div className="relative flex h-16 items-center space-x-3 rounded-lg border-2 border-gray-50 bg-gray-50 p-2 text-base font-semibold text-gray-600">
        <ExclamationPoint className="h-8 w-8 text-gray-400" />
        <span>This content is unavailable to you</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center rounded-lg border-2 border-gray-50 text-base transition-colors hover:border-gray-100 hover:bg-white group-one-hover:border-gray-100 group-one-hover:bg-white">
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
        {gang.invite ? (
          <button
            className="small-button bg-red text-white dark:text-black"
            onClick={reject}
          >
            Reject
          </button>
        ) : null}
        <button
          className="small-button ml-2 bg-blue text-white dark:text-black"
          onClick={group ? open : join}
        >
          {buttonMessage()}
        </button>
      </div>
    </div>
  );
}
