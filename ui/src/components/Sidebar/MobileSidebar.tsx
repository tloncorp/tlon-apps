import React from 'react';
import cn from 'classnames';
import { Outlet, useMatch } from 'react-router';
import { useNotifications } from '@/notifications/useNotifications';
import NavTab from '../NavTab';
import AppGroupsIcon from '../icons/AppGroupsIcon';
import ElipsisIcon from '../icons/EllipsisIcon';
import BellIcon from '../icons/BellIcon';
import Avatar from '../Avatar';

import MagnifyingGlassIcon from '../icons/MagnifyingGlass16Icon';

export default function MobileSidebar() {
  const ship = window.our;
  const profileMatch = useMatch('/profile/edit');
  const { count } = useNotifications();

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-r-2 border-gray-50 bg-white">
      <Outlet />
      <footer className="mobile-bottom-nav flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex justify-items-stretch">
            <NavTab to="/">
              <AppGroupsIcon className="mb-0.5 h-6 w-6" />
              Groups
            </NavTab>
            <NavTab to="/notifications">
              <BellIcon className="mb-0.5 h-6 w-6" />
              Activity
            </NavTab>
            <NavTab to="/find">
              <MagnifyingGlassIcon className="mb-0.5 h-6 w-6" />
              Find Groups
            </NavTab>
            <NavTab to="/profile/edit">
              <Avatar
                size="xs"
                ship={ship}
                className={cn(
                  'mb-1 h-6 w-6',
                  !profileMatch && 'opacity-50 grayscale'
                )}
              />
              Profile
            </NavTab>
            <NavTab to="/actions">
              <ElipsisIcon className="mb-0.5 h-6 w-6" />
              Options
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
