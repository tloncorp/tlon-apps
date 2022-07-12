import React from 'react';
import useNavStore from '../Nav/useNavStore';
import useSidebarSort from '../../logic/useSidebarSort';
import SidebarSorter from './SidebarSorter';
import NavTab from '../NavTab';
import GroupIcon from '../icons/GroupIcon';
import ActivityIndicator from './ActivityIndicator';
import AsteriskIcon from '../icons/Asterisk16Icon';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import GroupList from './GroupList';
import { usePinnedGroups } from '../../state/groups/groups';

export default function MobileSidebar() {
  const secondary = useNavStore((state) => state.secondary);
  const pinned = usePinnedGroups();
  const { sortFn, setSortFn, sortOptions } = useSidebarSort();
  // TODO: get notification count from hark store
  const notificationCount = 0;

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-r-2 border-gray-50 bg-white">
      <header className="flex-none px-2 py-1">
        {pinned ? (
          <ul>
            <GroupList pinned />
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
          <GroupList />
        ) : secondary === 'notifications' ? (
          <div />
        ) : secondary === 'search' ? (
          <div />
        ) : null}
      </nav>
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex items-center">
            <NavTab loc="main">
              <GroupIcon className="mb-0.5 h-6 w-6" />
              Groups
            </NavTab>
            <NavTab loc="notifications">
              <ActivityIndicator count={notificationCount} className="mb-0.5" />
              Notifications
            </NavTab>
            <NavTab loc="search">
              <MagnifyingGlassIcon className="mb-0.5 h-6 w-6" />
              Search
            </NavTab>
            <a
              className="no-underline"
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
