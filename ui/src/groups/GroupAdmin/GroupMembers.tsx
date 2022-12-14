import { Helmet } from 'react-helmet';
import cn from 'classnames';
import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAmAdmin, useGroup, useRouteGroup } from '@/state/groups/groups';
import { ViewProps } from '@/types/groups';

export default function GroupMembers({ title }: ViewProps) {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const amAdmin = useAmAdmin(flag);

  useEffect(() => {
    if (!amAdmin) {
      navigate('../');
    }
  }, [amAdmin, navigate]);

  if (!group) {
    return null;
  }

  return (
    <div className="card grow">
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
