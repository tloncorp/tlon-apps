import cn from 'classnames';
import React from 'react';
import { pluralize } from '../logic/utils';
import { Club } from '../types/chat';
import MultiDmAvatar from './MultiDmAvatar';
import ShipName from '../components/ShipName';

interface MultiDMHeroProps {
  club: Club;
}

export default function MultiDmHero({ club }: MultiDMHeroProps) {
  const count = club.team.length;
  const pendingCount = club.hive.length;
  const hasPending = pendingCount > 0;

  const shipList = (ships: Array<string>) =>
    ships.map((member: string, i: number) => {
      let sep;
      if (i !== ships.length - 1) {
        sep = ', ';
      }
      return (
        <span key={member}>
          <ShipName name={member} showAlias />
          {sep ? <span>{sep}</span> : null}
        </span>
      );
    });

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
        {shipList(club.team.concat(club.hive))}
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
