import React from 'react';
import { Outlet } from 'react-router';
import { NavLink } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useChatState, useDmList } from '../state/chat';

function DmSidebarItem(props: { ship: string }) {
  const { ship } = props;
  const brief = useChatState((s) => s.briefs[ship]);
  return (
    <li>
      <NavLink
        to={`/dm/${ship}`}
        className="flex items-center justify-between p-2"
      >
        <div className="flex items-center space-x-2">
          <Avatar size="small" ship={ship} />
          <span className="font-mono">{ship}</span>
        </div>
        {brief.count > 0 ? (
          <div className="h-2 w-2 rounded-full border bg-black" />
        ) : null}
      </NavLink>
    </li>
  );
}

export default function Dms() {
  const ships = useDmList();

  return (
    <div className="flex h-full w-full">
      <div className="flex flex-col space-y-2 border-r">
        <NavLink to="/dm/new">New DM</NavLink>
        <ul className="flex w-48 flex-col">
          {ships.map((ship) => (
            <DmSidebarItem key={ship} ship={ship} />
          ))}
        </ul>
      </div>
      <Outlet />
    </div>
  );
}
