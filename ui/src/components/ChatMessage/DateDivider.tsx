import React from 'react';
import usePrettyDay from '../../hooks/usePrettyDay';

interface DateDividerProps {
  date: Date;
}

export default function DateDivider({ date }: DateDividerProps) {
  const prettyDay = usePrettyDay(date);

  return (
    <div className="flex w-full items-center py-2">
      <div className="h-[2px] w-6 rounded-sm bg-gray-200">&nbsp;</div>
      <span className="whitespace-nowrap px-3 font-semibold text-gray-500">
        {prettyDay}
      </span>
      <div className="h-[2px] w-full rounded-sm bg-gray-200">&nbsp;</div>
    </div>
  );
}
