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
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import Layout from '@/components/Layout/Layout';

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
    <Layout
      className="flex-1 pt-4"
      header={
        <MobileHeader
          title="All Groups"
          action={
            <>
              <ReconnectingSpinner />
              <SidebarSorter
                sortFn={sortFn}
                setSortFn={setSortFn}
                sortOptions={sortOptions}
              />
            </>
          }
          secondaryAction={
            <Link
              className="default-focus flex items-center rounded-md bg-blue p-1 text-base"
              to="/groups/new"
              state={{ backgroundLocation: location }}
            >
              <AddIcon16 className="h-4 w-4 text-white" />
            </Link>
          }
        />
      }
    >
      <nav className="flex h-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex-1">
          <GroupsScrollingContext.Provider value={isScrolling}>
            <GroupList
              groups={sortedGroups}
              pinnedGroups={Object.entries(pinnedGroups)}
              isScrolling={scroll.current}
            >
              {Object.entries(pinnedGroups).length > 0 && (
                <div className="px-4">
                  <h2 className="mb-0.5 p-2 text-lg font-bold text-gray-400">
                    Pinned Groups
                  </h2>
                  {pinnedGroupsOptions}
                </div>
              )}

              <h2 className="my-2 ml-2 p-2 pl-4 text-lg font-bold text-gray-400">
                All Groups
              </h2>

              <div className="px-4">
                {gangs.map((flag) => (
                  <GangItem key={flag} flag={flag} />
                ))}
              </div>
            </GroupList>
          </GroupsScrollingContext.Provider>
        </div>
      </nav>
    </Layout>
  );
}
