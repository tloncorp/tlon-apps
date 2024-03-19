import {
  getGroups,
  getPinnedGroupsAndDms,
} from '@tloncorp/shared/dist/api/groupsApi';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';

import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import GangItem from '@/components/Sidebar/GangItem';
import GroupList from '@/components/Sidebar/GroupList';
import { GroupsScrollingContext } from '@/components/Sidebar/GroupsScrollingContext';
import GroupsSidebarItem from '@/components/Sidebar/GroupsSidebarItem';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import WelcomeCard from '@/components/WelcomeCard';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import AddGroupSheet from '@/groups/AddGroupSheet';
import GroupJoinList from '@/groups/GroupJoinList';
import { useBottomPadding } from '@/logic/position';
import useGroupSort from '@/logic/useGroupSort';
import {
  useGangsWithClaim,
  useGroupsWithQuery,
  useLoadingGroups,
  useNewGroups,
  usePendingGangsWithoutClaim,
  usePinnedGroups,
} from '@/state/groups';

export default function MobileRoot() {
  const { paddingBottom } = useBottomPadding();
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

  useEffect(() => {
    console.log('MOUNT GROUPS');
    Promise.all([getGroups(), getPinnedGroupsAndDms()])
      .then((result) => console.log('QUERY', result))
      .catch((e) => console.log('QUERY', e));
  }, []);

  const hasPinnedGroups = !!pinnedGroupsOptions.length;
  const hasLoadingGroups = !!loadingGroups.length;
  const hasGangsWithClaims = !!gangsWithClaims.length;
  const hasNewGroups = !!newGroups.length;
  const hasPendingGangs = Object.keys(pendingGangs).length > 0;

  // get all non-segmented groups
  const flagsToFilter = useMemo(() => {
    const flags = new Set();
    Object.entries(pinnedGroups).forEach(([flag]) => flags.add(flag));
    Object.entries(pendingGangs).forEach(([flag]) => flags.add(flag));
    loadingGroups.forEach(([flag]) => flags.add(flag));
    newGroups?.forEach(([flag]) => flags.add(flag));
    gangsWithClaims.forEach((flag) => flags.add(flag));
    return flags;
  }, [pinnedGroups, loadingGroups, newGroups, gangsWithClaims, pendingGangs]);

  const allOtherGroups = useMemo(
    () => sortedGroups.filter(([flag, _g]) => !flagsToFilter.has(flag)),
    [sortedGroups, flagsToFilter]
  );

  return (
    <Layout
      className="flex-1 bg-white"
      style={{
        paddingBottom,
      }}
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
      <nav
        className="flex h-full flex-1 flex-col overflow-y-auto overflow-x-hidden"
        data-testid="groups-menu"
      >
        <WelcomeCard />
        <div className="flex-1">
          <GroupsScrollingContext.Provider value={isScrolling}>
            <GroupList groups={allOtherGroups} isScrolling={scroll.current}>
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

                    {hasNewGroups &&
                      newGroups.map(([flag]) => (
                        <GroupsSidebarItem key={flag} flag={flag} isNew />
                      ))}
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
