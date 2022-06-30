import cn from 'classnames';
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAmAdmin, useRouteGroup } from '../../state/groups';

export default function GroupAdmin() {
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);

  return (
    <section className="my-5 mx-8 w-full max-w-3xl">
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
                  Info
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="members"
                  end
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
              <li>
                <NavLink
                  to="channels"
                  className={({ isActive }) =>
                    cn(
                      'default-focus inline-block rounded-md p-2 hover:bg-gray-50',
                      isActive && 'text-gray-800'
                    )
                  }
                >
                  Channel Settings
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
