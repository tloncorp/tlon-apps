import React from 'react';
import Lock16Icon from '@/components/icons/Lock16Icon';
import Globe16Icon from '@/components/icons/Globe16Icon';
import Private16Icon from '@/components/icons/Private16Icon';
import ShipName from '@/components/ShipName';
import { getFlagParts, getGroupPrivacy } from '@/logic/utils';
import { GroupPreview } from '@/types/groups';
import GroupAvatar from './GroupAvatar';

interface GroupSummaryProps extends Partial<GroupPreview> {
  flag: string;
}

export default function GroupSummary({
  flag,
  cordon,
  meta,
}: GroupSummaryProps) {
  const { ship } = getFlagParts(flag);
  const privacy = cordon && getGroupPrivacy(cordon);

  return (
    <div className="flex items-center space-x-3 font-semibold">
      <GroupAvatar {...meta} size="h-[72px] w-[72px]" />
      <div className="space-y-2">
        <h3>{meta?.title || flag}</h3>
        <p className="text-gray-400">
          Hosted by <ShipName name={ship} />
        </p>
        <div className="flex items-center space-x-2 text-gray-600">
          {privacy ? (
            <span className="inline-flex items-center space-x-1 capitalize">
              {privacy === 'public' ? (
                <Globe16Icon className="h-4 w-4" />
              ) : privacy === 'private' ? (
                <Lock16Icon className="h-4 w-4" />
              ) : (
                <Private16Icon className="h-4 w-4" />
              )}
              <span>{privacy}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
