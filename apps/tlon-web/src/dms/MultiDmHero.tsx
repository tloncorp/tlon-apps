import { Club } from '@tloncorp/shared/dist/urbit/dms';
import cn from 'classnames';
import React from 'react';

import ClubName from '@/components/ClubName';

import { pluralize } from '../logic/utils';
import PendingIndicator from './MultiDMPendingIndicator';
import MultiDmAvatar from './MultiDmAvatar';

interface MultiDMHeroProps {
  club: Club;
}

export default function MultiDmHero({ club }: MultiDMHeroProps) {
  const count = club.team.length;
  const pendingCount = club.hive.length;
  const hasPending = pendingCount > 0;

  return (
    <div className="flex flex-col items-center">
      <MultiDmAvatar {...club.meta} size="huge" className="mb-2" />
      {club.meta.title ? (
        <h2 className="mb-1 text-lg font-semibold">{club.meta.title}</h2>
      ) : null}
      <div
        className={cn(
          'mb-1 max-w-md font-semibold',
          club.meta.title && 'text-gray-600'
        )}
      >
        <ClubName club={club} />
      </div>
      <div className="text-gray-600">
        <span>{`${count} ${pluralize('Member', count)}${
          hasPending ? ',' : ''
        }`}</span>
        {hasPending ? <PendingIndicator hive={club.hive} /> : null}
      </div>
    </div>
  );
}
