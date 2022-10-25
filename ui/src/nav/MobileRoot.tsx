import GroupList from '@/components/Sidebar/GroupList';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import useGroupSort from '@/logic/useGroupSort';
import { hasKeys } from '@/logic/utils';
import { usePinnedGroups } from '@/state/chat';
import { useGroups } from '@/state/groups';
import React from 'react';

export default function MobileRoot() {
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const groups = useGroups();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);
  const sortedPinnedGroups = sortGroups(pinnedGroups);

  return (
    <>
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
        <SidebarSorter
          sortFn={sortFn}
          setSortFn={setSortFn}
          sortOptions={sortOptions}
          isMobile={true}
        />
      </header>
      <nav className="h-full flex-1 overflow-y-auto">
        <GroupList groups={sortedGroups} pinnedGroups={sortedPinnedGroups} />
      </nav>
    </>
  );
}
