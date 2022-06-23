import cn from 'classnames';
import React from 'react';
import { pluralize } from '../logic/utils';
import { Club } from '../types/chat';
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
      <MultiDmAvatar img={club.meta.image} size="huge" className="mb-2" />
      {club.meta.title ? (
        <h2 className="mb-1 text-lg font-semibold">{club.meta.title}</h2>
      ) : null}
      <div
        className={cn(
          'mb-1 max-w-md font-semibold',
          club.meta.title && 'text-gray-600'
        )}
      >
        {club.team.concat(club.hive).join(', ')}
      </div>
      <div className="text-gray-600">
        <span>{`${count} ${pluralize('Member', count)}${
          hasPending ? ',' : ''
        }`}</span>
        {hasPending ? (
          <span className="text-blue"> {pendingCount} Pending</span>
        ) : null}
      </div>
    </div>
  );
}
