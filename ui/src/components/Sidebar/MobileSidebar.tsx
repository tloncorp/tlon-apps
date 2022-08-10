import React from 'react';
import { usePinnedGroups } from '@/state/chat';
import { hasKeys } from '@/logic/utils';
import { useGroups } from '@/state/groups/groups';
import useGroupSort from '@/logic/useGroupSort';
import useNavStore from '../Nav/useNavStore';
import SidebarSorter from './SidebarSorter';
import NavTab from '../NavTab';
import GroupIcon from '../icons/GroupIcon';
import ActivityIndicator from './ActivityIndicator';
import AsteriskIcon from '../icons/Asterisk16Icon';
import GroupList from './GroupList';

export default function MobileSidebar() {
  const secondary = useNavStore((state) => state.secondary);
  // TODO: get notification count from hark store
  const notificationCount = 0;

  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const groups = useGroups();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);
  const sortedPinnedGroups = sortGroups(pinnedGroups);

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-r-2 border-gray-50 bg-white">
      <header className="flex-none px-2 py-1">
        {hasKeys(pinnedGroups) ? (
          <ul className="mb-3 space-y-2 sm:mb-2 sm:space-y-0 md:mb-0">
            <GroupList
              pinned
              groups={sortedGroups}
              pinnedGroups={sortedPinnedGroups}
            />
          </ul>
        ) : null}
        {secondary === 'main' ? (
          <SidebarSorter
            sortFn={sortFn}
            setSortFn={setSortFn}
            sortOptions={sortOptions}
            isMobile={true}
          />
        ) : (
          <h1 className="p-2 text-xl font-medium">
            {secondary === 'notifications'
              ? 'Notifications'
              : secondary === 'search'
              ? 'Search Groups'
              : null}
          </h1>
        )}
      </header>
      <nav className="h-full flex-1 overflow-y-auto">
        {secondary === 'main' ? (
          <GroupList groups={sortedGroups} pinnedGroups={sortedPinnedGroups} />
        ) : secondary === 'notifications' ? (
          <div />
        ) : secondary === 'search' ? (
          <div />
        ) : null}
      </nav>
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex justify-items-stretch">
            <NavTab loc="main">
              <GroupIcon className="mb-0.5 h-6 w-6" />
              Groups
            </NavTab>
            <NavTab loc="notifications">
              <ActivityIndicator count={notificationCount} className="mb-0.5" />
              Notifications
            </NavTab>
            <a
              className="flex-1 no-underline"
              href="https://github.com/tloncorp/homestead/issues/new?assignees=&amp;labels=bug&amp;template=bug_report.md&amp;title=groups:"
              target="_blank"
              rel="noreferrer"
            >
              <NavTab>
                <AsteriskIcon className="mb-0.5 h-6 w-6" />
                Submit Issue
              </NavTab>
            </a>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
