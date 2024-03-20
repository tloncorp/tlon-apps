import { ClientTypes } from '@tloncorp/shared';
import {
  getGroups,
  getPinnedGroupsAndDms,
} from '@tloncorp/shared/dist/api/groupsApi';
import { GroupList, GroupOptionsSheet } from '@tloncorp/ui';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import GangItem from '@/components/Sidebar/GangItem';
// import GroupList from '@/components/Sidebar/GroupList';
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
  const navigate = useNavigate();
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

  const [clientGroups, setClientGroups] = useState<{
    pinned: ClientTypes.Group[];
    other: ClientTypes.Group[];
  }>({ pinned: [], other: [] });

  const [longPressedGroup, setLongPressedGroup] =
    React.useState<ClientTypes.Group | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      const [allGroups, pinnedGroupIds] = await Promise.all([
        getGroups(),
        getPinnedGroupsAndDms(),
      ]);
      setClientGroups({
        pinned: allGroups.filter((group) => pinnedGroupIds.includes(group.id)),
        other: allGroups.filter((group) => !pinnedGroupIds.includes(group.id)),
      });
    }

    fetchGroups();
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
          className="h-[600]"
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
          <GroupList
            pinned={clientGroups.pinned}
            other={clientGroups.other}
            // onGroupPress={(group) => navigate(`/groups/${group.id}`)}
            onGroupPress={setLongPressedGroup}
          />

          <GroupOptionsSheet
            open={longPressedGroup !== null}
            onOpenChange={(open) =>
              !open ? setLongPressedGroup(null) : 'noop'
            }
            group={longPressedGroup ?? undefined}
          />

          {/* <GroupsScrollingContext.Provider value={isScrolling}>
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
          </GroupsScrollingContext.Provider> */}
          {/* <AddGroupSheet open={addGroupOpen} onOpenChange={setAddGroupOpen} /> */}

          {/* <div className="">
            {clientGroups.map((group) => (
              <GroupListItem key={group.id} model={group} />
            ))}
          </div> */}
        </div>
      </nav>
    </Layout>
  );
}
