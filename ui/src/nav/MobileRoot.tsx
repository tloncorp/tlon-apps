import React, { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import { debounce } from 'lodash';
import useGroupSort from '@/logic/useGroupSort';
import { usePinnedGroups } from '@/state/chat';
import { useGangList, useGroups } from '@/state/groups';
import GroupList from '@/components/Sidebar/GroupList';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import AddIcon16 from '@/components/icons/Add16Icon';
import GroupsSidebarItem from '@/components/Sidebar/GroupsSidebarItem';
import GangItem from '@/components/Sidebar/GangItem';
import { GroupsScrollingContext } from '@/components/Sidebar/GroupsScrollingContext';

export default function MobileRoot() {
  const location = useLocation();
  const [isScrolling, setIsScrolling] = useState(false);
  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const groups = useGroups();
  const gangs = useGangList();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);
  const pinnedGroupsOptions = useMemo(
    () =>
      Object.entries(pinnedGroups).map(([flag]) => (
        <GroupsSidebarItem key={flag} flag={flag} />
      )),
    [pinnedGroups]
  );

  return (
    <>
      <header className="flex items-center justify-between px-6 pt-10 pb-4">
        <h1 className="text-lg font-bold text-gray-800">My Groups</h1>
        <div className="flex flex-row space-x-4 self-end">
          <SidebarSorter
            sortFn={sortFn}
            setSortFn={setSortFn}
            sortOptions={sortOptions}
          />
          <Link
            className="default-focus flex items-center rounded-md bg-blue p-1 text-base"
            to="/groups/new"
            state={{ backgroundLocation: location }}
          >
            <AddIcon16 className="h-4 w-4 text-white" />
          </Link>
        </div>
      </header>

      <nav className="flex h-full flex-1 flex-col overflow-y-auto overflow-x-hidden px-4">
        <div className="flex-1">
          <GroupsScrollingContext.Provider value={isScrolling}>
            <GroupList
              groups={sortedGroups}
              pinnedGroups={Object.entries(pinnedGroups)}
              isScrolling={scroll.current}
            >
              {Object.entries(pinnedGroups).length > 0 && (
                <>
                  <h2 className="mb-0.5 p-2 text-lg font-bold text-gray-400">
                    Pinned Groups
                  </h2>
                  {pinnedGroupsOptions}
                </>
              )}

              <h2 className="my-2 p-2 text-lg font-bold text-gray-400">
                All Groups
              </h2>

              {gangs.map((flag) => (
                <GangItem key={flag} flag={flag} />
              ))}
            </GroupList>
          </GroupsScrollingContext.Provider>
        </div>
      </nav>
    </>
  );
}
