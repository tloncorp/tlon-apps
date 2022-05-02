import React from 'react';
import {makePrettyDayAndDateAndTime, makePrettyDayAndTime} from '../../utils';
import ShipImage from './ShipImage';

interface AuthorProps {
  ship: string;
  date: Date;
}
export default function Author({ ship, date }: AuthorProps) {
  const prettyDayAndTime = makePrettyDayAndTime(date);
  const prettyDayAndDateAndTime = makePrettyDayAndDateAndTime(date);

  return (
    <div className="align-center group flex flex items-center space-x-3 py-1">
      <ShipImage ship={ship} />
      <span className="text-md font-semibold">{ship}</span>
      <span className="hidden text-sm font-semibold text-gray-500 group-hover:block">
        {prettyDayAndDateAndTime}
      </span>
      <span className="block text-sm font-semibold text-gray-500 group-hover:hidden">
        {prettyDayAndTime}
      </span>
    </div>
  );
}
