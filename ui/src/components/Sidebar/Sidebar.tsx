import React, { useState, useRef, useMemo, useCallback } from 'react';
import cn from 'classnames';
import { useLocation } from 'react-router';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import GroupList from '@/components/Sidebar/GroupList';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useGroups, usePendingInvites } from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import AppGroupsIcon from '@/components/icons/AppGroupsIcon';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass16Icon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AddIcon16 from '@/components/icons/Add16Icon';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import { usePinnedGroups } from '@/state/chat';
import { hasKeys } from '@/logic/utils';
import ShipName from '@/components/ShipName';
import Avatar, { useProfileColor } from '@/components/Avatar';
import useGroupSort from '@/logic/useGroupSort';
import { useNotifications } from '@/notifications/useNotifications';
import { debounce } from 'lodash';
import ArrowNWIcon from '../icons/ArrowNWIcon';
import MenuIcon from '../icons/MenuIcon';

export function GroupsAppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <SidebarItem
      div
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
              className="no-underline"
              href="https://airtable.com/shrflFkf5UyDFKhmW"
              target="_blank"
              rel="noreferrer"
            >
              <DropdownMenu.Item className="dropdown-item pl-3 text-blue">
                Submit Feedback
              </DropdownMenu.Item>
            </a>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      <div className="flex items-center justify-between">
        Groups
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
  const [scrolledFromTop, setScrolledFromTop] = useState(false);

  const pendingInvitesCount = pendingInvites.length;
  const { count } = useNotifications();

  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const groups = useGroups();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);
  const sortedPinnedGroups = sortGroups(pinnedGroups);
  const shipColor = useProfileColor(window.our);

  const ref = useRef<HTMLUListElement>(null);

  const classes = useMemo(
    () =>
      cn(
        'flex w-full flex-col space-y-1 px-2 pt-2',
        scrolledFromTop && 'bottom-shadow'
      ),
    [scrolledFromTop]
  );

  // to prevent re-render, only set state when necessary
  const scrollHandler = useCallback(() => {
    debounce(() => {
      if (ref.current?.scrollTop === 0) {
        if (!scrolledFromTop) {
          setScrolledFromTop(true);
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (scrolledFromTop) {
          setScrolledFromTop(false);
        }
      }
    }, 100);
  }, [scrolledFromTop]);

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-col bg-white">
      <ul className={classes}>
        {/* TODO: FETCH WINDOW.OUR WITHOUT IT RETURNING UNDEFINED */}
        <GroupsAppMenu />
        <div className="h-5" />
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
              <span className="ml-auto font-semibold text-blue">
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
      </ul>
      <ul
        ref={ref}
        onScroll={scrollHandler}
        className="flex-initial overflow-y-auto overflow-x-hidden px-2"
      >
        {hasKeys(pinnedGroups) ? (
          <GroupList
            className="p-2"
            pinned
            groups={sortedGroups}
            pinnedGroups={sortedPinnedGroups}
          />
        ) : null}
        <li className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
          <span className="ml-4 text-sm font-semibold text-gray-400">
            All Groups
          </span>
        </li>
        <li className="relative p-2">
          <SidebarSorter
            sortFn={sortFn}
            setSortFn={setSortFn}
            sortOptions={sortOptions}
            isMobile={isMobile}
          />
        </li>
      </ul>
      <div className="flex-auto">
        <GroupList
          className="p-2"
          groups={sortedGroups}
          pinnedGroups={sortedPinnedGroups}
        />
      </div>
    </nav>
  );
}
