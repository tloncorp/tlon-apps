import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import GroupList from '@/components/Sidebar/GroupList';
import {
  useLoadingGroups,
  useGangsWithClaim,
  useGroupsWithQuery,
  usePinnedGroups,
  usePendingGangsWithoutClaim,
  useNewGroups,
} from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import useGroupSort from '@/logic/useGroupSort';
import GroupsSidebarItem from './GroupsSidebarItem';
import SidebarSorter from './SidebarSorter';
import GangItem from './GangItem';
import { GroupsScrollingContext } from './GroupsScrollingContext';
import SidebarTopMenu from './SidebarTopMenu';
import useActiveTab from './util';
import MessagesSidebar from './MessagesSidebar';
import useSearchFilter, { GroupSearchRecord } from './useSearchFilter';
import X16Icon from '../icons/X16Icon';

export default function Sidebar() {
  const isMobile = useIsMobile();
  const [isScrolling, setIsScrolling] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const { data: groups } = useGroupsWithQuery();
  const invitedGroups = usePendingGangsWithoutClaim();
  const pinnedGroups = usePinnedGroups();
  const loadingGroups = useLoadingGroups();
  const newGroups = useNewGroups();
  const gangsWithClaims = useGangsWithClaim();
  const sortedGroups = sortGroups(groups);
  const searchRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const activeTab = useActiveTab();

  const [searchInput, setSearchInput] = useState('');
  const hasSearch = searchInput.length > 0;
  const searchResults = useSearchFilter(searchInput);
  useEffect(() => {
    // if we switch between messages & groups, clear the search
    setSearchInput('');
    searchRef.current?.focus();
  }, [activeTab]);

  const atTopChange = useCallback((top: boolean) => setAtTop(top), []);
  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  // get all non-segmented groups
  const flagsToFilter = useMemo(() => {
    const flags = new Set();
    Object.entries(pinnedGroups).forEach(([flag]) => flags.add(flag));
    Object.entries(invitedGroups).forEach(([flag]) => flags.add(flag));
    loadingGroups.forEach(([flag]) => flags.add(flag));
    newGroups?.forEach(([flag]) => flags.add(flag));
    gangsWithClaims.forEach((flag) => flags.add(flag));
    return flags;
  }, [pinnedGroups, loadingGroups, newGroups, gangsWithClaims, invitedGroups]);

  const allOtherGroups = useMemo(
    () => sortedGroups.filter(([flag, _g]) => !flagsToFilter.has(flag)),
    [sortedGroups, flagsToFilter]
  );

  // we don't know how search results should appear in the result list
  // ahead of time, so we need to check for any special statuses
  const flagStatus = useMemo(() => {
    const accum = new Map<string, 'new' | 'invited' | 'loading'>();
    Object.keys(loadingGroups).forEach((flag) => {
      accum.set(flag, 'loading');
    });
    Object.keys(invitedGroups).forEach((flag) => {
      accum.set(flag, 'invited');
    });
    Object.keys(newGroups).forEach((flag) => {
      accum.set(flag, 'new');
    });
    return accum;
  }, [loadingGroups, newGroups, invitedGroups]);

  const augmentedSearchResults = useMemo(
    () =>
      searchResults.map((result) => ({
        ...result,
        status: flagStatus.get(result.flag),
      })),
    [searchResults, flagStatus]
  );

  const hasPinnedGroups = !!Object.keys(pinnedGroups).length;
  const hasLoadingGroups = !!loadingGroups.length;
  const hasGangsWithClaims = !!gangsWithClaims.length;
  const hasInvitedGroups = !!Object.keys(invitedGroups).length;
  const hasNewGroups = !!newGroups.length;

  const pinnedGroupsOptions = useMemo(
    () =>
      Object.keys(pinnedGroups).map((flag) => (
        <GroupsSidebarItem key={flag} flag={flag} />
      )),
    [pinnedGroups]
  );

  const invitedGroupsDisplay = useMemo(
    () =>
      Object.keys(invitedGroups).map((flag) => (
        <GangItem key={flag} flag={flag} invited />
      )),
    [invitedGroups]
  );

  const loadingGroupsDisplay = useMemo(
    () =>
      loadingGroups.map(([flag, _]) => (
        <GangItem key={flag} flag={flag} isJoining />
      )),
    [loadingGroups]
  );

  const gangsWithClaimsDisplay = useMemo(
    () => gangsWithClaims.map((flag) => <GangItem key={flag} flag={flag} />),
    [gangsWithClaims]
  );

  const newGroupsDisplay = useMemo(
    () =>
      newGroups.map(([flag]) => (
        <GroupsSidebarItem key={flag} flag={flag} isNew />
      )),
    [newGroups]
  );

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-full flex-none flex-col bg-white">
      <SidebarTopMenu />

      <div className="relative mb-1 flex">
        <input
          ref={searchRef}
          id="search"
          type="text"
          autoFocus
          className={cn(
            'input w-full border-none bg-white py-3 pl-4 pr-8 mix-blend-multiply placeholder:text-sm placeholder:font-medium dark:mix-blend-normal',
            !atTop && 'bottom-shadow'
          )}
          placeholder={
            activeTab === 'messages' ? 'Filter Messages' : 'Filter Groups'
          }
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button
          className={cn(
            'absolute right-3 top-3.5 h-4 w-4 text-gray-400',
            !searchInput && 'hidden'
          )}
          onClick={() => setSearchInput('')}
        >
          <X16Icon />
        </button>
      </div>

      <div className="flex-auto space-y-3 overflow-x-hidden sm:space-y-1">
        {activeTab !== 'messages' && (
          <GroupsScrollingContext.Provider value={isScrolling}>
            <GroupList
              groups={
                hasSearch
                  ? (augmentedSearchResults as GroupSearchRecord[])
                  : allOtherGroups
              }
              isScrolling={scroll.current}
              atTopChange={atTopChange}
            >
              {!hasSearch && (
                <>
                  <SidebarTopSection
                    title="Pinned Groups"
                    empty={!hasPinnedGroups && !hasInvitedGroups}
                  >
                    {hasPinnedGroups && pinnedGroupsOptions}
                    {hasInvitedGroups && invitedGroupsDisplay}
                  </SidebarTopSection>

                  <SidebarTopSection
                    title="Pending"
                    empty={!hasLoadingGroups && !hasGangsWithClaims}
                  >
                    {hasLoadingGroups && loadingGroupsDisplay}
                    {hasGangsWithClaims && gangsWithClaimsDisplay}
                  </SidebarTopSection>

                  <div ref={ref} className="flex-initial">
                    <div className="flex h-10 items-center justify-between border-t-2 border-gray-50 p-2 pb-1">
                      <h2 className="px-2 text-sm font-semibold text-gray-400">
                        {sortFn === 'A → Z'
                          ? 'Groups A → Z'
                          : 'Recent Activity'}
                      </h2>
                      <div className="pr-1">
                        <SidebarSorter
                          sortFn={sortFn}
                          setSortFn={setSortFn}
                          sortOptions={sortOptions}
                        />
                      </div>
                    </div>

                    {hasNewGroups && (
                      <div className="mx-2">{newGroupsDisplay}</div>
                    )}
                  </div>
                </>
              )}

              {hasSearch && (
                <SidebarTopSection
                  title={
                    augmentedSearchResults.length
                      ? 'Search results:'
                      : 'No groups found.'
                  }
                  empty={false}
                />
              )}
            </GroupList>
          </GroupsScrollingContext.Provider>
        )}
        {activeTab === 'messages' && (
          <MessagesSidebar searchQuery={searchInput} />
        )}
      </div>
    </nav>
  );
}

function SidebarTopSection({
  title,
  noBorder = false,
  children,
  empty,
}: {
  title?: string;
  noBorder?: boolean;
  children?: React.ReactNode;
  empty: boolean;
}) {
  if (empty) return null;

  return (
    <div
      className={cn(
        'mb-4 flex flex-col p-2 pb-1',
        !noBorder && 'border-t-2 border-gray-50'
      )}
    >
      {title && (
        <h2 className="p-2 text-sm font-semibold text-gray-400">{title}</h2>
      )}
      {children}
    </div>
  );
}
