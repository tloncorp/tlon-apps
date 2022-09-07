import React, { useEffect } from 'react';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup } from '@/state/groups/groups';
import useNavStore from '@/components/Nav/useNavStore';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import HashIcon16 from '@/components/icons/HashIcon16';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useNotifications } from '@/notifications/useNotifications';
import useHarkState from '@/state/hark';
import MobileGroupSidebar from './MobileGroupSidebar';
import ChannelList from './ChannelList';
import GroupAvatar from '../GroupAvatar';
import GroupActions from '../GroupActions';

export default function GroupSidebar() {
  const flag = useNavStore((state) => state.flag);
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const { count } = useNotifications(flag);

  useEffect(() => {
    useHarkState.getState().retrieveGroup(flag);

    return () => {
      useHarkState.getState().releaseGroup(flag);
    };
  }, [flag]);

  if (isMobile) {
    return <MobileGroupSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col bg-white">
      <header className="flex-none p-2 pb-0">
        <SidebarItem
          icon={<CaretLeft16Icon className="m-1 h-4 w-4 text-gray-400" />}
          to="/"
          onClick={() => navPrimary('main')}
        >
          Back to Groups
        </SidebarItem>
      </header>
      <div className="h-5" />
      <div className="flex min-h-0 flex-col px-2">
        <ul>
          <li className="group relative flex w-full items-center justify-between rounded-lg text-lg font-semibold text-gray-600 hover:bg-gray-50 sm:text-base">
            <GroupActions flag={flag} className="flex-1">
              <button className="default-focus flex w-full items-center space-x-3 rounded-lg p-2 pr-4 font-semibold">
                <GroupAvatar {...group?.meta} />
                <div
                  title={group?.meta.title}
                  className="max-w-full flex-1 truncate text-left"
                >
                  {group?.meta.title}
                </div>
              </button>
            </GroupActions>
          </li>
          <SidebarItem
            icon={<HashIcon16 className="m-1 h-4 w-4" />}
            to={`/groups/${flag}/channels`}
          >
            All Channels
          </SidebarItem>
        </ul>
      </div>
      <div className="mt-5 flex border-t-2 border-gray-50 pt-3 pb-2">
        <span className="ml-4 text-sm font-semibold text-gray-400">
          Channels
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChannelList className="p-2 pt-0" flag={flag} />
      </div>
    </nav>
  );
}
