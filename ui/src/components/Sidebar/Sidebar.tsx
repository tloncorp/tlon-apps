import React from 'react';
import { useIsMobile } from '../../logic/useMedia';
import AsteriskIcon from '../icons/Asterisk16Icon';
import MagnifyingGlass from '../icons/MagnifyingGlass16Icon';
import SidebarLink from './SidebarLink';
import AddIcon16 from '../icons/Add16Icon';
import useSidebarSort from '../../logic/useSidebarSort';
import SidebarSorter from './SidebarSorter';
import ActivityIndicator from './ActivityIndicator';
import MobileSidebar from './MobileSidebar';
import GroupList from './GroupList';

export default function Sidebar() {
  const isMobile = useIsMobile();
  const { sortFn, setSortFn, sortOptions } = useSidebarSort();
  // TODO: get notification count from hark store
  const notificationCount = 0;

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col border-r-2 border-gray-50 bg-white">
      <ul className="flex-none p-2">
        <SidebarLink
          icon={<ActivityIndicator count={notificationCount} />}
          to={`/notifications`}
        >
          Notifications
        </SidebarLink>
        <SidebarLink
          icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
          to="/search"
        >
          Search My Groups
        </SidebarLink>
        <SidebarLink
          color="text-blue"
          icon={<AsteriskIcon className="m-1 h-4 w-4" />}
          to="/groups/join"
        >
          Join Group
        </SidebarLink>
        <SidebarLink
          color="text-green"
          icon={<AddIcon16 className="m-1 h-4 w-4" />}
          to="/groups/new"
        >
          Create Group
        </SidebarLink>
        <li className="p-2">
          <SidebarSorter
            sortFn={sortFn}
            setSortFn={setSortFn}
            sortOptions={sortOptions}
            isMobile={isMobile}
          />
        </li>
      </ul>
      <GroupList className="flex-1 overflow-y-auto" />
    </nav>
  );
}
