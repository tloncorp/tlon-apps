import React from 'react';
import { Outlet } from 'react-router';
import { NavLink } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useDmList } from '../state/chat';

export default function Dms() {
  const ships = useDmList();
  return (
    <div className="flex h-full w-full">
      <div className="flex flex-col space-y-2 border-r">
        <NavLink to="/dm/new">New DM</NavLink>
        <ul className="flex w-48 flex-col">
          {ships.map((ship) => (
            <li key={ship}>
              <NavLink
                to={`/dm/${ship}`}
                className="flex items-center space-x-2 p-2"
              >
                <Avatar size="small" ship={ship} />
                <span className="font-mono">{ship}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <Outlet />
    </div>
  );
}
