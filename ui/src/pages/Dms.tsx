import React from 'react';
import { Outlet } from 'react-router';

export default function Dms() {
  return (
    <div className="flex h-full w-full">
      <Outlet />
    </div>
  );
}
