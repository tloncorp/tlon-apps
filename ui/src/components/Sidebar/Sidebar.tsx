import React from 'react';
import { useLocation } from 'react-router';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import GroupList from '@/components/Sidebar/GroupList';
import { useGroups, usePendingInvites } from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass16Icon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AddIcon16 from '@/components/icons/Add16Icon';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';
import { usePinnedGroups } from '@/state/chat';
import { hasKeys } from '@/logic/utils';
import { useOurContact } from '@/state/contact';
import ShipName from '@/components/ShipName';
import Avatar from '@/components/Avatar';
import useGroupSort from '@/logic/useGroupSort';

export default function Sidebar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const pendingInvites = usePendingInvites();
  const contact = useOurContact();
  const currentShip = window.ship;

  const pendingInvitesCount = pendingInvites.length;
  // TODO: get notification count from hark store
  const notificationCount = 0;

  const { sortFn, setSortFn, sortOptions, sortGroups } = useGroupSort();
  const groups = useGroups();
  const pinnedGroups = usePinnedGroups();
  const sortedGroups = sortGroups(groups);
  const sortedPinnedGroups = sortGroups(pinnedGroups);

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-col border-r-2 border-gray-50 bg-white">
      <ul className="flex w-full flex-col px-2 pt-2">
        {/* TODO: FETCH WINDOW.OUR WITHOUT IT RETURNING UNDEFINED */}
        <SidebarItem
          icon={<Avatar size="xs" ship={window.our} />}
          to={'/profile/edit'}
        >
          <ShipName showAlias name={window.our} />
        </SidebarItem>
        <SidebarItem
          icon={<ActivityIndicator count={notificationCount} />}
          to={`/notifications`}
        >
          Notifications
        </SidebarItem>
        <SidebarItem
          icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
          to="/groups/find"
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
          color="text-blue"
          highlight="bg-blue-soft dark:bg-blue-900 hover:bg-blue-soft hover:dark:bg-blue-900"
          icon={<AddIcon16 className="m-1 h-4 w-4" />}
          to="/groups/new"
          state={{ backgroundLocation: location }}
        >
          Create Group
        </SidebarItem>
        <a
          className="no-underline"
          href="https://github.com/tloncorp/homestead/issues/new?assignees=&labels=bug&template=bug_report.md&title=groups:"
          target="_blank"
          rel="noreferrer"
        >
          <SidebarItem
            color="text-yellow-600 dark:text-yellow-500"
            highlight="bg-yellow-soft hover:bg-yellow-soft hover:dark:bg-yellow-800"
            icon={<AsteriskIcon className="m-1 h-4 w-4" />}
          >
            Submit Issue
          </SidebarItem>
        </a>
        {hasKeys(pinnedGroups) ? (
          <GroupList
            className="flex-1 overflow-y-scroll pr-0"
            pinned
            groups={sortedGroups}
            pinnedGroups={sortedPinnedGroups}
          />
        ) : null}
        <li className="p-2">
          <SidebarSorter
            sortFn={sortFn}
            setSortFn={setSortFn}
            sortOptions={sortOptions}
            isMobile={isMobile}
          />
        </li>
      </ul>
      <GroupList
        className="flex-1 overflow-x-hidden overflow-y-scroll pr-0 pt-0"
        groups={sortedGroups}
        pinnedGroups={sortedPinnedGroups}
      />
    </nav>
  );
}
