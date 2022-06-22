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
  return (
    <div className="flex flex-col items-center space-y-1">
      <MultiDmAvatar img={club.meta.image} />
      {club.meta.title ? (
        <h2 className="text-lg font-semibold">{club.meta.title}</h2>
      ) : null}
      <div
        className={cn(
          'max-w-md font-semibold',
          club.meta.title && 'text-gray-600'
        )}
      >
        {club.team.join(', ')}
      </div>
      <div className="text-gray-600">{`${count} ${pluralize(
        'Member',
        count
      )}`}</div>
    </div>
  );
}
