import React from 'react';
import { makePrettyDay } from '../../logic/utils';

interface DateDividerProps {
  date: Date;
}

export default function DateDivider({ date }: DateDividerProps) {
  const prettyDay = makePrettyDay(date);

  return (
    <div className="flex w-full items-center py-4">
      <div className="h-[2px] w-8 rounded-sm bg-gray-200">&nbsp;</div>
      <span className="whitespace-nowrap px-3 font-semibold text-gray-400">
        {prettyDay}
      </span>
      <div className="h-[2px] w-full rounded-sm bg-gray-200">&nbsp;</div>
    </div>
  );
}
