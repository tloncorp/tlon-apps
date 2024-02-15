import cn from 'classnames';
import React from 'react';

import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';
import ArchiveIcon from '../components/icons/ArchiveIcon';

interface DMArchiveItemProps {
  ship: string;
}

export default function DMArchiveItem({ ship }: DMArchiveItemProps) {
  return (
    <li>
      <div
        className={cn(
          'flex items-center justify-between rounded-lg p-2 text-gray-600'
        )}
      >
        <div className="flex items-center space-x-2">
          <Avatar size="xs" ship={ship} />
          <ShipName className="font-semibold" name={ship} />
        </div>
        <ArchiveIcon className="h-6 w-6" />
      </div>
    </li>
  );
}
