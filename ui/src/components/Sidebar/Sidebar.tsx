import React from 'react';
import { useLocation } from 'react-router';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import GroupList from '@/components/Sidebar/GroupList';
import { usePinnedGroups } from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass16Icon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AddIcon16 from '@/components/icons/Add16Icon';
import useSidebarSort from '@/logic/useSidebarSort';
import SidebarSorter from '@/components/Sidebar/SidebarSorter';

export default function Sidebar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const pinned = usePinnedGroups();
  const { sortFn, setSortFn, sortOptions } = useSidebarSort();
  // TODO: get notification count from hark store
  const notificationCount = 0;

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-col border-r-2 border-gray-50 bg-white">
      <ul className="flex w-full flex-col px-2 pt-2">
        <SidebarItem
          icon={<ActivityIndicator count={notificationCount} />}
          to={`/notifications`}
        >
          Notifications
        </SidebarItem>
        <SidebarItem
          icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
          to="/search"
        >
          Search My Groups
        </SidebarItem>
        <SidebarItem
          color="text-blue hover:bg-blue-soft hover:dark:bg-blue-900"
          highlight="bg-blue-soft dark:bg-blue-900"
          icon={<AsteriskIcon className="m-1 h-4 w-4" />}
          to="/groups/join"
        >
          Join Group
        </SidebarItem>
        <SidebarItem
          color="text-green hover:bg-green-soft hover:dark:bg-green-900"
          highlight="bg-green-soft dark:bg-green-900"
          icon={<AddIcon16 className="m-1 h-4 w-4" />}
          to="/groups/new"
          state={{ backgroundLocation: location }}
        >
          Create Group
        </SidebarItem>
        {pinned.length > 0 ? (
          <GroupList className="flex-1 overflow-y-scroll pr-0" pinned />
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
      <GroupList className="flex-1 overflow-x-hidden overflow-y-scroll pr-0 pt-0" />
    </nav>
  );
}
