import React from 'react';
import cn from 'classnames';
import { NavLink } from 'react-router-dom';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';
import { useChatState } from '../state/chat';
import DmOptions from './DMOptions';
import UnknownAvatarIcon from '../components/icons/UnknownAvatarIcon';

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
    <li className="group relative flex items-center justify-between rounded-lg text-gray-600">
      <NavLink
        to={`/dm/${ship}`}
        className="default-focus flex flex-1 items-center rounded-lg p-2"
      >
        {pending ? (
          <UnknownAvatarIcon className="h-6 text-blue" />
        ) : (
          <Avatar size="xs" ship={ship} />
        )}
        <ShipName className="ml-2 font-semibold" name={ship} />
        {(brief?.count ?? 0) > 0 || pending ? (
          <div
            className="ml-auto h-2 w-2 rounded-full bg-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
            aria-label="Has New Messages"
          />
        ) : null}
      </NavLink>
      <DmOptions
        ship={ship}
        className="group-two absolute right-0 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
      />
    </li>
  );
}
