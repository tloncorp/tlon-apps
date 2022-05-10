import React from 'react';
import { Outlet } from 'react-router';
import { NavLink } from 'react-router-dom';
import ShipImage from '../components/ChatMessage/ShipImage';
import { useDmList } from '../state/chat';

export default function Dms() {
  const ships = useDmList();
  return (
    <div className="flex h-full w-full">
      <ul className="flex w-48 flex-col border-r">
        {ships.map((ship) => (
          <li key={ship}>
            <NavLink
              to={`/dm/${ship}`}
              className="flex items-center space-x-2 p-2"
            >
              <ShipImage ship={ship} />
              <span className="font-mono">{ship}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <Outlet />
    </div>
  );
}
