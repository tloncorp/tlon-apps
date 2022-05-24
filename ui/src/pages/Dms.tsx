import React from 'react';
import { Outlet } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import cn from 'classnames';
import Avatar from '../components/Avatar';
import { useChatState, useDmList, usePendingDms } from '../state/chat';
import ShipName from '../components/ShipName';
import NewMessageIcon from '../components/icons/NewMessageIcon';

function DmSidebarItem(props: { ship: string; pending?: boolean }) {
  const { ship, pending = false } = props;
  const brief = useChatState((s) => s.briefs[ship]);
  return (
    <li>
      <NavLink
        to={`/dm/${ship}`}
        className={cn(
          'flex items-center justify-between rounded-md p-2 text-gray-600',
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

export default function Dms() {
  const ships = useDmList();
  const pending = usePendingDms();

  return (
    <div className="flex h-full w-full">
      <div className="flex min-w-52 flex-col space-y-2 border-r-2 border-gray-50 p-2">
        <div className="flex items-center justify-between px-2">
          {/*
            TODO: replace this span with a dropdown for different message types.
          */}
          <span className="font-semibold">All messages</span>
          <Link to="/dm/new">
            <NewMessageIcon className="h-6 text-blue" />
          </Link>
        </div>
        <ul className="flex w-48 flex-col">
          {pending.map((ship) => (
            <DmSidebarItem pending key={ship} ship={ship} />
          ))}
          {ships.map((ship) => (
            <DmSidebarItem key={ship} ship={ship} />
          ))}
        </ul>
      </div>
      <Outlet />
    </div>
  );
}
