import { Helmet } from 'react-helmet';
import cn from 'classnames';
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useGroup, useRouteGroup } from '@/state/groups/groups';
import { ViewProps } from '@/types/groups';

export default function GroupMembers({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  if (!group) {
    return null;
  }

  return (
    <div className="card">
      <Helmet>
        <title>
          {group ? `Members of ${group.meta.title} ${title}` : title}{' '}
        </title>
      </Helmet>
      <nav>
        <ul className="flex items-center space-x-3 text-lg font-bold text-gray-400">
          <li>
            <NavLink
              end
              to="../members"
              className={({ isActive }) => cn(isActive && 'text-gray-800')}
            >
              Members
            </NavLink>
          </li>
          <li>
            <NavLink
              to="../members/pending"
              className={({ isActive }) => cn(isActive && 'text-gray-800')}
            >
              Pending
            </NavLink>
          </li>
          <li>
            <NavLink
              to="../members/banned"
              className={({ isActive }) => cn(isActive && 'text-gray-800')}
            >
              Banned
            </NavLink>
          </li>
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
