import cn from 'classnames';
import React from 'react';
import { Outlet, useLocation, useMatch } from 'react-router';
import { useNotifications } from '@/notifications/useNotifications';
import NavTab from '../NavTab';
import GroupIcon from '../icons/GroupIcon';
import ActivityIndicator from './ActivityIndicator';
import AsteriskIcon from '../icons/Asterisk16Icon';
import Avatar from '../Avatar';
import AddIcon16 from '../icons/Add16Icon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';

export default function MobileSidebar() {
  const { count } = useNotifications();
  const location = useLocation();
  const isProfile = useMatch('/profile/*');

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-r-2 border-gray-50 bg-white">
      <Outlet />
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex justify-items-stretch">
            <NavTab to="/" aria-label="Groups">
              <GroupIcon className="mb-0.5 h-6 w-6" />
            </NavTab>
            <NavTab to="/notifications" aria-label="Notifications">
              <ActivityIndicator count={count} className="mb-0.5" />
            </NavTab>
            <NavTab to="/groups/new" state={{ backgroundLocation: location }}>
              <div className="icon-button bg-blue text-white dark:bg-blue-900 dark:text-blue">
                <AddIcon16 className="h-4 w-4" />
              </div>
            </NavTab>
            <NavTab to="/find">
              <MagnifyingGlassIcon className="mb-0.5 h-6 w-6" />
            </NavTab>
            <NavTab
              linkClass="no-underline"
              href="https://github.com/tloncorp/homestead/issues/new?assignees=&amp;labels=bug&amp;template=bug_report.md&amp;title=groups:"
              target="_blank"
              rel="noreferrer"
              aria-label="Submit Issue"
            >
              <AsteriskIcon className="mb-0.5 h-6 w-6" />
            </NavTab>
            <NavTab to="/profile/edit" aria-label="Profile">
              <Avatar
                size="xs"
                ship={window.our}
                className={cn('mb-0.5', !isProfile && 'opacity-70 grayscale')}
              />
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
