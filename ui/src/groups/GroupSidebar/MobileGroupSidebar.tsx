import React from 'react';
import cn from 'classnames';
import { Outlet, useMatch } from 'react-router';
import { useGroup, useGroupFlag } from '@/state/groups/groups';
import HashIcon from '@/components/icons/HashIcon';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import NavTab from '@/components/NavTab';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import GroupAvatar from '../GroupAvatar';

export default function MobileGroupSidebar() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const match = useMatch('/groups/:ship/:name/info');
  // TODO: get activity count from hark store
  const activityCount = 0;

  return (
    <section className="flex h-full w-full flex-col overflow-x-hidden border-r-2 border-gray-50 bg-white">
      <Outlet />
      <footer className="mt-auto flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex items-center">
            <NavTab to="." end aria-label="Channels">
              <HashIcon className="mb-0.5 h-6 w-6" />
            </NavTab>
            <NavTab to="./info" aria-label="Group Info">
              <GroupAvatar
                {...group?.meta}
                size="h-6 w-6"
                className={cn('mb-0.5', !match && 'opacity-50')}
              />
            </NavTab>
            <NavTab to="./activity" aria-label="Activity">
              <ActivityIndicator count={activityCount} className="mb-0.5" />
            </NavTab>
            <NavTab
              linkClass="flex-1 no-underline"
              href="https://github.com/tloncorp/homestead/issues/new?assignees=&amp;labels=bug&amp;template=bug_report.md&amp;title=groups:"
              target="_blank"
              rel="noreferrer"
              aria-label="Submit Issue"
            >
              <AsteriskIcon className="mb-0.5 h-6 w-6" />
            </NavTab>
            <NavTab to="./actions" aria-label="Group Actions">
              <ElipsisIcon className="mb-0.5 h-6 w-6" />
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
