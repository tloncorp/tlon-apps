import cn from 'classnames';
import React from 'react';
import { useIsMobile } from '../../logic/useMedia';
import { useGroup } from '../../state/groups';
import { GroupMeta } from '../../types/groups';
import useNavStore from '../Nav/useNavStore';
import CaretLeft16Icon from '../icons/CaretLeft16Icon';
import MagnifyingGlass from '../icons/MagnifyingGlass16Icon';
import HashIcon16 from '../icons/HashIcon16';
import MobileGroupSidebar from './MobileGroupSidebar';
import ChannelList from './ChannelList';
import ActivityIndicator from '../Sidebar/ActivityIndicator';
import GroupAvatar from '../GroupAvatar';
import SidebarItem from '../Sidebar/SidebarItem';

function GroupHeader({ meta }: { meta?: GroupMeta }) {
  if (!meta) {
    return null;
  }

  return (
    <li className="flex items-center space-x-3 rounded-lg p-2 text-base font-semibold text-gray-600">
      <GroupAvatar img={meta?.image} />
      <h3>{meta?.title}</h3>
    </li>
  );
}

export default function GroupSidebar() {
  const flag = useNavStore((state) => state.flag);
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const navSetMain = useNavStore((state) => state.setLocationMain);
  // TODO: get activity count from hark store
  const activityCount = 0;

  if (isMobile) {
    return <MobileGroupSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col overflow-hidden border-r-2 border-gray-50 bg-white sm:p-2">
      <header className="flex-none px-2 py-1 sm:p-0">
        <button
          className="default-focus flex w-full items-center rounded-lg p-2 text-base font-semibold text-gray-600 hover:bg-gray-50"
          onClick={navSetMain}
        >
          <CaretLeft16Icon className="m-1 mr-4 h-4 w-4 text-gray-400" />
          All Groups
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-0">
        <ul className="flex-none">
          <GroupHeader meta={group?.meta} />
          <SidebarItem
            icon={<ActivityIndicator count={activityCount} />}
            to={`/groups/${flag}/activity`}
          >
            Activity
          </SidebarItem>
          <SidebarItem
            icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
            to={`/groups/${flag}/search`}
          >
            Find in Group
          </SidebarItem>
          <SidebarItem
            icon={<HashIcon16 className="m-1 h-4 w-4" />}
            to={`/groups/${flag}/all`}
          >
            All Channels
          </SidebarItem>
        </ul>
        <div className="flex-1 overflow-y-auto">
          <ChannelList flag={flag} />
        </div>
      </div>
    </nav>
  );
}
