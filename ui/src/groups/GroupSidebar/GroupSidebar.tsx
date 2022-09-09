import React, { useEffect, useState } from 'react';
import cn from 'classnames';
import { mix } from 'color2k';
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
import { isColor } from '@/logic/utils';
import { foregroundFromBackground } from '@/components/Avatar';
import MobileGroupSidebar from './MobileGroupSidebar';
import ChannelList from './ChannelList';
import GroupAvatar from '../GroupAvatar';
import GroupActions from '../GroupActions';

export default function GroupSidebar() {
  const flag = useNavStore((state) => state.flag);
  const group = useGroup(flag);
  const [groupCoverHover, setGroupCoverHover] = useState(false);
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

  const coverStyles = () => {
    if (group && isColor(group.meta.cover))
      return {
        backgroundColor: group.meta.cover,
        color: foregroundFromBackground(group.meta.cover),
      };
    if (group && !isColor(group.meta.cover)) {
      return {
        height: '240px',
        backgroundImage: `url(${group.meta.cover})`,
        backgroundSize: 'cover',
      };
    }
    return {};
  };

  const coverButtonStyles = () => {
    if (group && isColor(group.meta.cover))
      return {
        backgroundColor:
          groupCoverHover === true
            ? mix(group.meta.cover, 'black', 0.33)
            : 'transparent',
        color: foregroundFromBackground(group.meta.cover),
      };
    if (group && !isColor(group.meta.cover)) {
      return {
        color: 'white',
        backgroundColor:
          groupCoverHover === true ? 'rgba(0, 0, 0, .5)' : 'transparent',
      };
    }
    return {};
  };

  const titleStyles = () => {
    if (group && isColor(group.meta.cover))
      return {
        color: foregroundFromBackground(group.meta.cover),
      };
    if (group && !isColor(group.meta.cover)) {
      return {
        color: 'white',
      };
    }
    return {};
  };

  return (
    <nav className="flex h-full w-64 flex-none flex-col bg-white">
      <div className="h-5" />
      <div className="flex min-h-0 flex-col px-2">
        <ul>
          <li
            className="group relative mb-2 flex w-full flex-col justify-between rounded-lg text-lg font-semibold text-gray-600 sm:text-base"
            style={coverStyles()}
          >
            <SidebarItem
              icon={<CaretLeft16Icon className="m-1 h-4 w-4" />}
              to="/"
              onClick={() => navPrimary('main')}
              onMouseEnter={() => setGroupCoverHover(true)}
              onMouseLeave={() => setGroupCoverHover(false)}
              highlight="hover:bg-transparent"
              style={coverButtonStyles()}
            >
              {groupCoverHover && <span>Back to Groups</span>}
            </SidebarItem>
            <GroupActions flag={flag} className="">
              <button className="default-focus flex w-full items-center space-x-3 rounded-lg p-2 pr-4 font-semibold">
                <GroupAvatar {...group?.meta} />
                <div
                  title={group?.meta.title}
                  style={titleStyles()}
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
