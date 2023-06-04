import cn from 'classnames';
import React from 'react';
import BellIcon from '../icons/BellIcon';

interface ActivityIndicatorProps {
  count: number;
  bg?: string;
  className?: string;
}

export default function ActivityIndicator({
  count,
  bg = 'bg-gray-100',
  className,
}: ActivityIndicatorProps) {
  return (
    <div
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded text-sm font-semibold',
        count === 0 ? 'bg-transparent' : 'bg-gray-100',
        bg,
        className
      )}
    >
      {count === 0 ? (
        <BellIcon className="m-0.5 h-5 w-5" />
      ) : count > 99 ? (
        '99+'
      ) : (
        count
      )}
    </div>
  );
}
