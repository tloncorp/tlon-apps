import React, { useState } from 'react';
import usePrettyDayAndDateAndTime from '../../hooks/usePrettyDayAndDateAndTime';
import usePrettyDayAndTime from '../../hooks/usePrettyDayAndTime';
import ShipImage from './ShipImage';

interface AuthorProps {
  ship: string;
  date: Date;
}
export default function Author({ ship, date }: AuthorProps) {
  const prettyDayAndTime = usePrettyDayAndTime(date);
  const prettyDayAndDateAndTime = usePrettyDayAndDateAndTime(date);
  const [showFullDate, setShowFullDate] = useState(false);

  return (
    <div className="align-center flex flex items-center space-x-3 py-1"
      onMouseOver={() => setShowFullDate(true)}
      onMouseLeave={() => setShowFullDate(false)}
    >
      <ShipImage ship={ship} />
      <span className="text-md font-semibold">{ship}</span>
      <span className="text-sm font-semibold text-gray-500">
        {showFullDate ? prettyDayAndDateAndTime : prettyDayAndTime}
      </span>
    </div>
  );
}
