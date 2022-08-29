import React, { useEffect } from 'react';
import GroupSummary from '@/groups/GroupSummary';
import useGroupJoin from '@/groups/useGroupJoin';
import { useGang, useGroup, useGroupState } from '@/state/groups';
import GroupAvatar from '@/groups/GroupAvatar';
import { getFlagParts } from '@/logic/utils';
import ShipName from '@/components/ShipName';
import Globe16Icon from '@/components/icons/Globe16Icon';
import Lock16Icon from '@/components/icons/Lock16Icon';
import Private16Icon from '@/components/icons/Private16Icon';

interface GroupReferenceProps {
  flag: string;
}

export default function GroupReference({ flag }: GroupReferenceProps) {
  const gang = useGang(flag);
  const { group, privacy, open, join, reject } = useGroupJoin(flag, gang);
  const { ship } = getFlagParts(flag);

  const meta = group?.meta || gang?.preview?.meta;

  useEffect(() => {
    if (!gang?.preview && !group) {
      useGroupState.getState().search(flag);
    }
  }, [gang, group, flag]);

  return (
    <div className="relative flex items-center rounded-lg border-2 border-gray-50 text-base">
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
            <span className="inline-flex items-center space-x-1 capitalize text-gray-400">
              {privacy === 'public' ? (
                <Globe16Icon className="h-4 w-4" />
              ) : privacy === 'private' ? (
                <Lock16Icon className="h-4 w-4" />
              ) : (
                <Private16Icon className="h-4 w-4" />
              )}
              <span>{privacy} Group</span>
            </span>
          </div>
        </div>
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
          className="button ml-2 bg-blue-soft text-blue mix-blend-multiply dark:bg-blue-900 dark:mix-blend-screen"
          onClick={group ? open : join}
        >
          {group ? 'Open' : 'Join'}
        </button>
      </div>
    </div>
  );
}
