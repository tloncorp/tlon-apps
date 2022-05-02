import React from 'react';
import usePrettyDayAndTime from '../../hooks/usePrettyDayAndTime';
import ShipImage from './ShipImage';

interface AuthorProps {
  ship: string;
  date: Date;
}
export default function Author({ ship, date }: AuthorProps) {
  const prettyDayAndTime = usePrettyDayAndTime(date);
  return (
    <div className="align-center flex flex items-center space-x-3 py-1">
      <ShipImage ship={ship} />
      <span className="text-md font-semibold">{ship}</span>
      <span className="text-sm font-semibold text-gray-500">
        {prettyDayAndTime}
      </span>
    </div>
  );
}
