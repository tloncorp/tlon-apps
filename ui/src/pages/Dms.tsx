import React from 'react';
import { Outlet } from 'react-router';
import { NavLink } from 'react-router-dom';
import cn from 'classnames';
import Avatar from '../components/Avatar';
import { useChatState, useDmList, usePendingDms } from '../state/chat';

function DmSidebarItem(props: { ship: string; pending?: boolean }) {
  const { ship, pending = false } = props;
  const brief = useChatState((s) => s.briefs[ship]);
  return (
    <li>
      <NavLink
        to={`/dm/${ship}`}
        className={cn('flex items-center justify-between p-2', {
          'bg-blue-400 text-white': pending,
        })}
      >
        <div className="flex items-center space-x-2">
          <Avatar size="small" ship={ship} />
          <span className="font-mono">{ship}</span>
        </div>
        {(brief?.count ?? 0) > 0 ? (
          <div className="h-2 w-2 rounded-full border bg-black" />
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
      <div className="flex flex-col space-y-2 border-r">
        <NavLink to="/dm/new">New DM</NavLink>

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
