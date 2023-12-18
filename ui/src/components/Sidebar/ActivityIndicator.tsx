import cn from 'classnames';
import React from 'react';
import BulletIcon from '../icons/BulletIcon';

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
        'flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold',
        bg,
        className
      )}
    >
      {count === 0 ? (
        <BulletIcon className="m-0.5 h-5 w-5" />
      ) : count > 99 ? (
        '99+'
      ) : (
        count
      )}
    </div>
  );
}
