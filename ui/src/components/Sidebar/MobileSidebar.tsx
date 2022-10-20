import React from 'react';
import { Outlet } from 'react-router';
import { useNotifications } from '@/notifications/useNotifications';
import NavTab from '../NavTab';
import GroupIcon from '../icons/GroupIcon';
import ActivityIndicator from './ActivityIndicator';
import AsteriskIcon from '../icons/Asterisk16Icon';

export default function MobileSidebar() {
  const { count } = useNotifications();

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-r-2 border-gray-50 bg-white">
      <Outlet />
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex justify-items-stretch">
            <NavTab to="/">
              <GroupIcon className="mb-0.5 h-6 w-6" />
              Groups
            </NavTab>
            <NavTab to="/notifications">
              <ActivityIndicator count={count} className="mb-0.5" />
              Notifications
            </NavTab>
            <NavTab
              linkClass="no-underline"
              href="https://github.com/tloncorp/homestead/issues/new?assignees=&amp;labels=bug&amp;template=bug_report.md&amp;title=groups:"
              target="_blank"
              rel="noreferrer"
            >
              <AsteriskIcon className="mb-0.5 h-6 w-6" />
              Submit Issue
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
