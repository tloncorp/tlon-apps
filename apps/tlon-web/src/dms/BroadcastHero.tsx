import { Club } from '@tloncorp/shared/dist/urbit/dms';
import cn from 'classnames';
import React from 'react';

import ClubName from '@/components/ClubName';
import { Cohort } from '@/state/broadcasts';

import { pluralize } from '../logic/utils';
import PendingIndicator from './MultiDMPendingIndicator';
import MultiDmAvatar from './MultiDmAvatar';

interface MultiDMHeroProps {
  cohort: Cohort;
}

export default function BroadcastHero({ cohort }: MultiDMHeroProps) {
  const count = cohort.targets.length;

  return (
    <div className="flex flex-col items-center">
      <MultiDmAvatar size="huge" className="mb-2" />
      {cohort.title ? (
        <h2 className="mb-1 text-lg font-semibold">{cohort.title}</h2>
      ) : null}
      <div
        className={cn(
          'mb-1 max-w-md font-semibold',
          cohort.title && 'text-gray-600'
        )}
      >
        {cohort.title}
      </div>
      <div className="text-gray-600">
        <span>{`${count} ${pluralize('Target', count)}`}</span>
      </div>
    </div>
  );
}
