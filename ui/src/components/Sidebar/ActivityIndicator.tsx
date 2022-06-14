import React from 'react';
import BulletIcon from '../icons/BulletIcon';

interface ActivityIndicatorProps {
  count: number;
}

export default function ActivityIndicator({ count }: ActivityIndicatorProps) {
  return (
    <div>
      {count === 0 ? (
        <BulletIcon className="h-6 w-6 rounded bg-gray-50 p-2" />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-50">
          {count > 99 ? '99+' : count}
        </div>
      )}
    </div>
  );
}
