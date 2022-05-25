import React from 'react';
import cn from 'classnames';
import { NavLink } from 'react-router-dom';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';
import { useChatState } from '../state/chat';

interface DMSidebarItemProps {
  ship: string;
  pending?: boolean;
}

export default function DmSidebarItem({
  ship,
  pending = false,
}: DMSidebarItemProps) {
  const brief = useChatState((s) => s.briefs[ship]);

  return (
    <li>
      <NavLink
        to={`/dm/${ship}`}
        className={cn(
          'flex items-center justify-between rounded-lg p-2 text-gray-600',
          {
            'bg-blue-400 text-white': pending,
          }
        )}
      >
        <div className="flex items-center space-x-2">
          <Avatar size="xs" ship={ship} />
          <ShipName className="font-semibold" name={ship} />
        </div>
        {(brief?.count ?? 0) > 0 ? (
          <div className="h-2 w-2 rounded-full border bg-blue" />
        ) : null}
      </NavLink>
    </li>
  );
}
