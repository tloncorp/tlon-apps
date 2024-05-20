import cn from 'classnames';
import React, { Ref } from 'react';

import { makePrettyDay, pluralize } from '@/logic/utils';

interface DateDividerProps {
  date: Date;
  unreadCount?: number;
  notify?: boolean;
}

function DateDividerComponent(
  { date, unreadCount, notify }: DateDividerProps,
  ref: Ref<HTMLDivElement>
) {
  const prettyDay = makePrettyDay(date);

  return (
    <div ref={ref} className="flex w-full items-center pb-6 pt-4">
      <div
        className={cn(
          'h-[2px] w-8 rounded-sm',
          unreadCount ? (notify ? 'bg-blue' : 'bg-gray-400') : 'bg-gray-200'
        )}
      >
        &nbsp;
      </div>
      <span
        className={cn(
          'whitespace-nowrap px-3 font-semibold',
          unreadCount && notify ? 'text-blue' : 'text-gray-400'
        )}
      >
        {prettyDay}
        {unreadCount ? (
          <>
            &nbsp;&bull;&nbsp;
            {unreadCount} new {pluralize('message', unreadCount)} below
          </>
        ) : null}
      </span>
      <div
        className={cn(
          'h-[2px] w-full rounded-sm',
          unreadCount ? (notify ? 'bg-blue' : 'bg-gray-400') : 'bg-gray-200'
        )}
      >
        &nbsp;
      </div>
    </div>
  );
}

const DateDivider = React.forwardRef(DateDividerComponent);

export default DateDivider;
