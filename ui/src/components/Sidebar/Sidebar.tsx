import { useState, useRef, useMemo, useCallback, useContext } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import GroupList from '@/components/Sidebar/GroupList';
import {
  useGangList,
  useLoadingGroups,
  useGangsWithClaim,
  useGroupsWithQuery,
  usePendingInvites,
  usePendingGangsWithoutClaim,
} from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import AppGroupsIcon from '@/components/icons/AppGroupsIcon';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass16Icon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AddIcon16 from '@/components/icons/Add16Icon';
import { usePinnedGroups } from '@/state/groups';
import ShipName from '@/components/ShipName';
import Avatar, { useProfileColor } from '@/components/Avatar';
import useGroupSort from '@/logic/useGroupSort';
import { useNotifications } from '@/notifications/useNotifications';
import { AppUpdateContext } from '@/logic/useAppUpdates';
import ArrowNWIcon from '../icons/ArrowNWIcon';
import MenuIcon from '../icons/MenuIcon';
import GroupsSidebarItem from './GroupsSidebarItem';
import SidebarSorter from './SidebarSorter';
import GangItem from './GangItem';
import { GroupsScrollingContext } from './GroupsScrollingContext';
import ReconnectingSpinner from '../ReconnectingSpinner';
import SystemChrome from './SystemChrome';
import ActionMenu, { Action } from '../ActionMenu';
import { DesktopUpdateButton } from '../UpdateNotices';

export function GroupsAppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const actions: Action[] = [
    {
      key: 'submit',
      type: 'prominent',
      content: (
        <a
          className="no-underline"
          href="https://airtable.com/shrflFkf5UyDFKhmW"
          target="_blank"
          rel="noreferrer"
        >
          Submit Feedback
        </a>
      ),
    },
    {
      key: 'about',
      content: (
        <Link to="/about" state={{ backgroundLocation: location }}>
          About Groups
        </Link>
      ),
    },
    {
      key: 'settings',
      content: (
        <Link
          to="/settings"
          className=""
          state={{ backgroundLocation: location }}
        >
          App Settings
        </Link>
      ),
    },
  ];

  return (
    <ActionMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      actions={actions}
      align="start"
    >
      <SidebarItem
        className={cn(
          menuOpen
            ? 'bg-gray-100 text-gray-800'
            : 'text-black hover:text-gray-800',
          'group'
        )}
        icon={
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
            href="/apps/landscape"
            target="_blank"
            rel="noreferrer"
            className={cn(
              'h-6 w-6 no-underline',
              menuOpen ? 'block' : 'hidden group-hover:block'
            )}
            // Prevents the dropdown trigger from being fired (therefore, opening the menu)
            onPointerDown={(e) => {
              e.stopPropagation();
              return false;
            }}
          >
            <ArrowNWIcon className="text-gray-400" />
          </a>
        </div>
      </SidebarItem>
    </ActionMenu>
  );
}

export default function Sidebar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { needsUpdate } = useContext(AppUpdateContext);
  const pendingInvites = usePendingInvites();
  const [isScrolling, setIsScrolling] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const pendingInvitesCount = pendingInvites.length;
  const { count } = useNotifications();
  const { data: groups, isLoading } = useGroupsWithQuery();
  const gangs = useGangList();
  const pinnedGroups = usePinnedGroups();
  const loadingGroups = useLoadingGroups();
  const gangsWithClaims = useGangsWithClaim();
  const pendingGangs = usePendingGangsWithoutClaim();
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

  const hasPinnedGroups = !!pinnedGroupsOptions.length;
  const hasLoadingGroups = !!loadingGroups.length;
  const hasGangsWithClaims = !!gangsWithClaims.length;
  const hasPendingGangs = Object.keys(pendingGangs).length;

  const atTopChange = useCallback((top: boolean) => setAtTop(top), []);
  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-full flex-none flex-col bg-white">
      <div
        className={cn('flex w-full flex-col space-y-0.5 p-2', {
          'bottom-shadow': !atTop,
        })}
      >
        {needsUpdate ? <DesktopUpdateButton /> : <GroupsAppMenu />}
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
          Activity
        </SidebarItem>
        <SidebarItem
          icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
          to="/find"
        >
          <div className="flex items-center">
            Discover
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
            pinnedGroups={pinnedGroups}
            loadingGroups={loadingGroups}
            isScrolling={scroll.current}
            atTopChange={atTopChange}
          >
            {hasPinnedGroups && (
              <div className="mb-4 flex flex-col border-t-2 border-gray-50 p-2 pb-1">
                <h2 className="p-2 text-sm font-semibold text-gray-400">
                  Pinned Groups
                </h2>
                {pinnedGroupsOptions}
              </div>
            )}

            {(hasLoadingGroups || hasGangsWithClaims) && (
              <div className="mb-4 flex flex-col border-t-2 border-gray-50 p-2 pb-1">
                <h2 className="p-2 text-sm font-semibold text-gray-400">
                  Pending
                </h2>
                {hasLoadingGroups &&
                  loadingGroups.map(([flag, _]) => (
                    <GangItem key={flag} flag={flag} isJoining />
                  ))}
                {hasGangsWithClaims &&
                  gangsWithClaims.map((flag) => (
                    <GangItem key={flag} flag={flag} />
                  ))}
              </div>
            )}
            <div ref={ref} className="flex-initial">
              <div className="flex h-10 items-center justify-between border-t-2 border-gray-50 p-2 pb-1">
                <h2 className="px-2 text-sm font-semibold text-gray-400">
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

              {!sortedGroups.length && !isLoading && (
                <div className="mx-4 my-2 rounded-lg bg-indigo-50 p-4 leading-5 text-gray-700 dark:bg-indigo-900/50">
                  Check out <strong>Discover</strong> above to find new groups
                  in your network or view group invites.
                </div>
              )}
            </div>
          </GroupList>
        </GroupsScrollingContext.Provider>
      </div>
    </nav>
  );
}
