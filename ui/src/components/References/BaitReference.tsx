import { useGroup } from '@/state/groups';
import { BaitCite } from '@/types/chat';
import cn from 'classnames';
import React from 'react';
import ExclamationPoint from '../icons/ExclamationPoint';

export default function BaitReference({
  group,
  graph,
  where,
}: BaitCite['bait']) {
  const theGroup = useGroup(group);
  const groupTitle = theGroup?.meta.title;

  return (
    <div className="heap-inline-block group">
      <div className="h-full w-full p-2">
        <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-gray-50 font-semibold text-gray-600">
          <ExclamationPoint className="mb-3 h-12 w-12" />
          <span>This content is still being migrated.</span>
          <span className="font-mono">{where}</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t-2 border-gray-50 p-2 group-hover:bg-gray-50">
        <div className="flex cursor-pointer items-center space-x-2 text-gray-400 group-hover:text-gray-600">
          <span className="font-semibold">{graph}</span>
          {groupTitle ? (
            <>
              <span className="font-bold">•</span>
              <span className="font-semibold">{groupTitle}</span>
            </>
          ) : (
            group
          )}
        </div>
      </div>
    </div>
  );
}
