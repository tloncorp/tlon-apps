import React from 'react';
import {
  makePrettyDayAndDateAndTime,
  makePrettyDayAndTime,
} from '../../logic/utils';
import Avatar from '../../components/Avatar';
import ShipName from '../../components/ShipName';

interface AuthorProps {
  ship: string;
  date: Date;
}
export default function Author({ ship, date }: AuthorProps) {
  const prettyDayAndTime = makePrettyDayAndTime(date);
  const prettyDayAndDateAndTime = makePrettyDayAndDateAndTime(date);

  return (
    <div className="align-center group flex items-center space-x-3 py-1">
      <Avatar ship={ship} size="xs" />
      <ShipName name={ship} showAlias className="text-md font-semibold" />
      <span className="hidden text-sm font-semibold text-gray-500 group-hover:block">
        {prettyDayAndDateAndTime}
      </span>
      <span className="block text-sm font-semibold text-gray-500 group-hover:hidden">
        {prettyDayAndTime}
      </span>
    </div>
  );
}
