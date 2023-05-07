import React from 'react';
import cn from 'classnames';
import { NavLink, Outlet } from 'react-router-dom';
import { useAmAdmin, useRouteGroup } from '@/state/groups/groups';

export default function GroupAdmin() {
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);

  return (
    <section className="flex h-full w-full flex-1 grow flex-col overflow-y-auto bg-gray-50 p-6">
      {isAdmin ? (
        <header className="card mb-4 p-2">
          <nav>
            <ul className="flex items-center font-semibold text-gray-400">
              <li>
                <NavLink
                  to="../info"
                  end
                  className={({ isActive }) =>
                    cn(
                      'default-focus inline-block rounded-md p-2 hover:bg-gray-50',
                      isActive && 'text-gray-800'
                    )
                  }
                >
                  Group Info
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="members"
                  className={({ isActive }) =>
                    cn(
                      'default-focus inline-block rounded-md p-2 hover:bg-gray-50',
                      isActive && 'text-gray-800'
                    )
                  }
                >
                  Members
                </NavLink>
              </li>
            </ul>
          </nav>
        </header>
      ) : null}
      <Outlet />
    </section>
  );
}
