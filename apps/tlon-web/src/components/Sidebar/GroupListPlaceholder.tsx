import { randomElement, randomIntInRange } from '@/logic/utils';
import cn from 'classnames';
import * as React from 'react';

function GroupItemPlaceholder() {
  const background = `bg-gray-${randomElement([100, 200, 400])}`;

  return (
    <li className="relative flex w-full items-center justify-between rounded-lg">
      <div className="flex w-full flex-1 items-center space-x-3 rounded-lg p-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-sm sm:h-6 sm:w-6" />
        <div
          className={cn(background, 'h-4 rounded-md')}
          style={{ width: `${randomIntInRange(50, 180)}px` }}
        />
      </div>
    </li>
  );
}

interface GroupListPlaceholderProps {
  count: number;
  pulse?: boolean;
}

function GroupListPlaceholder({
  count,
  pulse = true,
}: GroupListPlaceholderProps) {
  return (
    <ul
      className={cn('h-full space-y-3 p-2 sm:space-y-0', {
        'animate-pulse': pulse,
      })}
    >
      {new Array(count).fill(true).map((_, i) => (
        <GroupItemPlaceholder key={i} />
      ))}
    </ul>
  );
}

export default React.memo(GroupListPlaceholder);
