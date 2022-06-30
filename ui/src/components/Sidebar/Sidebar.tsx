import React from 'react';
import { useIsMobile } from '../../logic/useMedia';
import AsteriskIcon from '../icons/Asterisk16Icon';
import MagnifyingGlass from '../icons/MagnifyingGlass16Icon';
import SidebarItem from './SidebarItem';
import AddIcon16 from '../icons/Add16Icon';
import useSidebarSort from '../../logic/useSidebarSort';
import SidebarSorter from './SidebarSorter';
import ActivityIndicator from './ActivityIndicator';
import MobileSidebar from './MobileSidebar';
import GroupList from './GroupList';
import { usePinnedGroups } from '../../state/groups/groups';

export default function Sidebar() {
  const isMobile = useIsMobile();
  const pinned = usePinnedGroups();
  const { sortFn, setSortFn, sortOptions } = useSidebarSort();
  // TODO: get notification count from hark store
  const notificationCount = 0;

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col border-r-2 border-gray-50 bg-white">
      <ul className="flex-none p-2">
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
      <GroupList className="flex-1 overflow-x-hidden overflow-y-scroll pr-0" />
    </nav>
  );
}
