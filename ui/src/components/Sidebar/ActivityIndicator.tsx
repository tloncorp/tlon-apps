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
        'flex h-6 w-6 items-center justify-center rounded text-sm font-semibold',
        bg,
        className
      )}
    >
      {count === 0 ? (
        <BulletIcon className="h-6 w-6" />
      ) : count > 99 ? (
        '99+'
      ) : (
        count
      )}
    </div>
  );
}
