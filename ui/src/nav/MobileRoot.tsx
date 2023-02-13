import React, { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import useGroupSort from '@/logic/useGroupSort';
import { usePinnedGroups } from '@/state/chat';
import { useGangList, useGroups } from '@/state/groups';
import GroupList from '@/components/Sidebar/GroupList';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import AddIcon from '@/components/icons/AddIcon';
import GroupsSidebarItem from '@/components/Sidebar/GroupsSidebarItem';
import GangItem from '@/components/Sidebar/GangItem';
import { debounce } from 'lodash';
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
          <GroupsScrollingContext.Provider value={isScrolling}>
            <GroupList
              groups={sortedGroups}
              pinnedGroups={Object.entries(pinnedGroups)}
              isScrolling={scroll.current}
            >
              {Object.entries(pinnedGroups).length > 0 && (
                <>
                  <li className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
                    <span className="ml-4 text-sm font-semibold text-gray-400">
                      Pinned Groups
                    </span>
                  </li>
                  {pinnedGroupsOptions}
                </>
              )}
              <ul className="mb-3 space-y-2 px-2 sm:mb-2 sm:space-y-0 md:mb-0">
                <li className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
                  <span className="ml-4 text-sm font-semibold text-gray-400">
                    All Groups
                  </span>
                </li>
              </ul>
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
