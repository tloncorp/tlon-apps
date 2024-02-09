import { useMemo, useRef, useState } from 'react';
import { debounce } from 'lodash';
import useGroupSort from '@/logic/useGroupSort';
import {
  useLoadingGroups,
  useGangsWithClaim,
  useGroupsWithQuery,
  usePendingGangsWithoutClaim,
  useNewGroups,
  usePinnedGroups,
} from '@/state/groups';
import GroupList from '@/components/Sidebar/GroupList';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import GroupsSidebarItem from '@/components/Sidebar/GroupsSidebarItem';
import GangItem from '@/components/Sidebar/GangItem';
import { GroupsScrollingContext } from '@/components/Sidebar/GroupsScrollingContext';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import Layout from '@/components/Layout/Layout';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import GroupJoinList from '@/groups/GroupJoinList';
import NavigateIcon from '@/components/icons/NavigateIcon';
import WelcomeCard from '@/components/WelcomeCard';
import AddGroupSheet from '@/groups/AddGroupSheet';

export default function MobileRoot() {
  const [isScrolling, setIsScrolling] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const pinnedGroups = usePinnedGroups();
  const pendingGangs = usePendingGangsWithoutClaim();
  const loadingGroups = useLoadingGroups();
  const newGroups = useNewGroups();
  const gangsWithClaims = useGangsWithClaim();
  const { data: groups } = useGroupsWithQuery();
  const sortedGroups = sortGroups(groups);
  const pinnedGroupsOptions = useMemo(
    () =>
      Object.entries(pinnedGroups).map(([flag]) => (
        <GroupsSidebarItem key={flag} flag={flag} />
      )),
    [pinnedGroups]
  );

  const newGroupsOptions = useMemo(
    () =>
      Object.keys(newGroups).map(([flag]) => (
        <GroupsSidebarItem key={flag} flag={flag} isNew />
      )),
    [newGroups]
  );

  const hasPinnedGroups = !!pinnedGroupsOptions.length;
  const hasLoadingGroups = !!loadingGroups.length;
  const hasGangsWithClaims = !!gangsWithClaims.length;
  const hasNewGroups = !!newGroups.length;
  const hasPendingGangs = Object.keys(pendingGangs).length > 0;

  return (
    <Layout
      className="flex-1 bg-white"
      header={
        <MobileHeader
          title="Groups"
          action={
            <div className="flex h-12 items-center justify-end space-x-2">
              <ReconnectingSpinner />
              <SidebarSorter
                sortFn={sortFn}
                setSortFn={setSortFn}
                sortOptions={sortOptions}
              />
              <button onClick={() => setAddGroupOpen(true)}>
                <AddIconMobileNav className="h-8 w-8 text-black" />
              </button>
            </div>
          }
        />
      }
    >
      <nav className="flex h-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <WelcomeCard />
        <div className="flex-1">
          <GroupsScrollingContext.Provider value={isScrolling}>
            <GroupList groups={sortedGroups} isScrolling={scroll.current}>
              {hasPinnedGroups ||
              hasPendingGangs ||
              hasGangsWithClaims ||
              hasLoadingGroups ||
              hasNewGroups ? (
                <>
                  <div className="px-4">
                    {hasPinnedGroups ? (
                      <>
                        <h2 className="mb-0.5 p-2 font-sans text-gray-400">
                          Pinned
                        </h2>
                        {pinnedGroupsOptions}

                        <h2 className="my-2 p-2 font-sans text-gray-400">
                          All Groups
                        </h2>
                      </>
                    ) : null}

                    {hasLoadingGroups &&
                      Object.keys(loadingGroups).map(([flag, _]) => (
                        <GangItem key={flag} flag={flag} isJoining />
                      ))}

                    {hasGangsWithClaims &&
                      gangsWithClaims.map((flag) => (
                        <GangItem key={flag} flag={flag} />
                      ))}

                    {hasNewGroups && newGroupsOptions}
                  </div>

                  {hasPendingGangs && (
                    <GroupJoinList highlightAll gangs={pendingGangs} />
                  )}
                </>
              ) : null}
            </GroupList>
          </GroupsScrollingContext.Provider>
          <AddGroupSheet open={addGroupOpen} onOpenChange={setAddGroupOpen} />
        </div>
      </nav>
    </Layout>
  );
}
