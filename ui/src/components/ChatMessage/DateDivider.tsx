import React from 'react';
import { differenceInDays, format } from 'date-fns';

interface DateDividerProps {
  date: Date;
}

export default function DateDivider({ date }: DateDividerProps) {
  const dateDifference = differenceInDays(new Date(), date);
  const prettyDay = () => {
    switch (dateDifference) {
      case 0:
        return 'Today';
      case 1:
        return 'Yesterday';
      default:
        return `${format(date, 'LLLL')} ${format(date, 'do')}`;
    }
  };

  return (
    <div className="flex w-full items-center">
      <div className="h-[2px] w-6 rounded-sm bg-gray-200">&nbsp;</div>
      <span className="whitespace-nowrap px-3 font-semibold text-gray-500">
        {prettyDay()}
      </span>
      <div className="h-[2px] w-full rounded-sm bg-gray-200">&nbsp;</div>
    </div>
  );
}
