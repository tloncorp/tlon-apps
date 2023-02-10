import React from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import useGroupSort from '@/logic/useGroupSort';
import { usePinnedGroups } from '@/state/chat';
import { useGroups } from '@/state/groups';
import GroupList from '@/components/Sidebar/GroupList';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import AddIcon from '@/components/icons/AddIcon';

export default function MobileRoot() {
  const location = useLocation();
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const groups = useGroups();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4">
        <h1 className="text-base font-bold">My Groups</h1>
        <div className="flex items-center space-x-5">
          <SidebarSorter
            sortFn={sortFn}
            setSortFn={setSortFn}
            sortOptions={sortOptions}
            isMobile={true}
          />
          <Link
            className="default-focus flex items-center rounded bg-blue p-1 text-base font-semibold"
            to="/groups/new"
            state={{ backgroundLocation: location }}
          >
            <AddIcon className="h-4 w-4 text-white" />
          </Link>
        </div>
      </header>
      <nav className="flex h-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex-1">
          <GroupList
            groups={sortedGroups}
            pinnedGroups={Object.entries(pinnedGroups)}
          />
        </div>
      </nav>
    </>
  );
}
