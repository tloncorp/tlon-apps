import React, { useState, useRef, useMemo, useCallback } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import GroupList from '@/components/Sidebar/GroupList';
import { useGangList, useGroups, usePendingInvites } from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import AppGroupsIcon from '@/components/icons/AppGroupsIcon';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass16Icon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AddIcon16 from '@/components/icons/Add16Icon';
import { usePinnedGroups } from '@/state/chat';
import ShipName from '@/components/ShipName';
import Avatar, { useProfileColor } from '@/components/Avatar';
import useGroupSort from '@/logic/useGroupSort';
import { useNotifications } from '@/notifications/useNotifications';
import ArrowNWIcon from '../icons/ArrowNWIcon';
import MenuIcon from '../icons/MenuIcon';
import AsteriskIcon from '../icons/Asterisk16Icon';
import GroupsSidebarItem from './GroupsSidebarItem';
import SidebarSorter from './SidebarSorter';
import GangItem from './GangItem';
import { GroupsScrollingContext } from './GroupsScrollingContext';
import ReconnectingSpinner from '../ReconnectingSpinner';
import SystemChrome from './SystemChrome';

export function GroupsAppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <SidebarItem
      className={cn(
        menuOpen
          ? 'bg-gray-100 text-gray-800'
          : 'text-black hover:text-gray-800',
        'group'
      )}
      icon={
        <DropdownMenu.Root onOpenChange={() => setMenuOpen(!menuOpen)}>
          <DropdownMenu.Trigger asChild className="appearance-none">
            <div className={cn('h-6 w-6 rounded group-hover:bg-gray-100')}>
              <AppGroupsIcon
                className={cn(
                  'h-6 w-6',
                  menuOpen ? 'hidden' : 'group-hover:hidden'
                )}
              />
              <MenuIcon
                aria-label="Open Menu"
                className={cn(
                  'm-1 h-4 w-4 text-gray-800',
                  menuOpen ? 'block' : 'hidden group-hover:block'
                )}
              />
            </div>
          </DropdownMenu.Trigger>

          <DropdownMenu.Content className="dropdown mt-2 -ml-2 w-60">
            <a
              className="dropdown-item flex flex-row items-center p-2 no-underline"
              href="https://airtable.com/shrflFkf5UyDFKhmW"
              target="_blank"
              rel="noreferrer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md text-blue">
                <AsteriskIcon className="h-6 w-6" />
              </div>
              <DropdownMenu.Item className="dropdown-item pl-3 text-blue">
                Submit Feedback
              </DropdownMenu.Item>
            </a>
            <Link
              to="/about"
              className="dropdown-item flex flex-row items-center p-2 no-underline"
              state={{ backgroundLocation: location }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md">
                <AppGroupsIcon className="h-6 w-6" />
              </div>
              <DropdownMenu.Item className="dropdown-item pl-3 text-gray-600">
                About Groups
              </DropdownMenu.Item>
            </Link>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      <div className="flex items-center justify-between">
        Groups
        <ReconnectingSpinner
          className={cn(
            'h-4 w-4 group-hover:hidden',
            menuOpen ? 'hidden' : 'block'
          )}
        />
        <a
          title="Back to Landscape"
          aria-label="Back to Landscape"
          href="/apps/grid"
          target="_blank"
          rel="noreferrer"
          className={cn(
            'h-6 w-6 no-underline',
            menuOpen ? 'block' : 'hidden group-hover:block'
          )}
        >
          <ArrowNWIcon className="text-gray-400" />
        </a>
      </div>
    </SidebarItem>
  );
}

export default function Sidebar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const pendingInvites = usePendingInvites();
  const [isScrolling, setIsScrolling] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const pendingInvitesCount = pendingInvites.length;
  const { count } = useNotifications();
  const groups = useGroups();
  const gangs = useGangList();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);
  const shipColor = useProfileColor(window.our);
  const ref = useRef<HTMLDivElement>(null);
  const pinnedGroupsOptions = useMemo(
    () =>
      Object.entries(pinnedGroups).map(([flag]) => (
        <GroupsSidebarItem key={flag} flag={flag} />
      )),
    [pinnedGroups]
  );

  const atTopChange = useCallback((top: boolean) => setAtTop(top), []);
  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col bg-white">
      <div
        className={cn('flex w-full flex-col space-y-0.5 p-2', {
          'bottom-shadow': !atTop,
        })}
      >
        <GroupsAppMenu />
        <SystemChrome />
        <SidebarItem
          highlight={shipColor}
          icon={<Avatar size="xs" ship={window.our} />}
          to={'/profile/edit'}
        >
          <ShipName showAlias name={window.our} />
        </SidebarItem>
        <SidebarItem
          icon={<ActivityIndicator count={count} />}
          to={`/notifications`}
          defaultRoute
        >
          Notifications
        </SidebarItem>
        <SidebarItem
          icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
          to="/find"
        >
          <div className="flex items-center">
            Find Groups
            {pendingInvitesCount > 0 ? (
              <span className="ml-auto pr-2 font-semibold text-blue">
                {pendingInvitesCount}
              </span>
            ) : null}
          </div>
        </SidebarItem>
        <SidebarItem
          icon={<AddIcon16 className="m-1 h-4 w-4" />}
          to="/groups/new"
          state={{ backgroundLocation: location }}
        >
          Create Group
        </SidebarItem>
      </div>
      <div className="flex-auto space-y-3 overflow-x-hidden sm:space-y-1">
        <GroupsScrollingContext.Provider value={isScrolling}>
          <GroupList
            groups={sortedGroups}
            pinnedGroups={Object.entries(pinnedGroups)}
            isScrolling={scroll.current}
            atTopChange={atTopChange}
          >
            {Object.entries(pinnedGroups).length > 0 && (
              <div className="mb-4 flex flex-col border-t-2 border-gray-50 p-2 pb-1">
                <h2 className="p-2 text-sm font-bold text-gray-400">
                  Pinned Groups
                </h2>
                {pinnedGroupsOptions}
              </div>
            )}
            <div ref={ref} className="flex-initial">
              <div className="flex h-10 items-center justify-between border-t-2 border-gray-50 p-2 pb-1">
                <h2 className="px-2 text-sm font-bold text-gray-400">
                  {sortFn === 'A → Z' ? 'Groups A → Z' : 'Recent Activity'}
                </h2>
                <div className="pr-1">
                  <SidebarSorter
                    sortFn={sortFn}
                    setSortFn={setSortFn}
                    sortOptions={sortOptions}
                  />
                </div>
              </div>
              <div className="relative">
                {!sortedGroups.length && (
                  <div className="mt-4 rounded-lg bg-indigo-50 p-4 leading-5 text-gray-700 dark:bg-indigo-900/50">
                    Check out <strong>Find Groups</strong> above to find new
                    groups in your network or view group invites.
                  </div>
                )}
              </div>
            </div>
            {gangs.map((flag) => (
              <GangItem key={flag} flag={flag} />
            ))}
          </GroupList>
        </GroupsScrollingContext.Provider>
      </div>
    </nav>
  );
}
