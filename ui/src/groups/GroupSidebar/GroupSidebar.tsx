import cn from 'classnames';
import _ from 'lodash';
import React from 'react';
import { useIsDark } from '@/logic/useMedia';
import { useAmAdmin, useGroup, useGroupFlag } from '@/state/groups/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import BellIcon from '@/components/icons/BellIcon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useCalm } from '@/state/settings';
import { isColor } from '@/logic/utils';
import { foregroundFromBackground } from '@/components/Avatar';
import ChannelList from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import GroupActions from '@/groups/GroupActions';
import HashIcon from '@/components/icons/HashIcon';
import AddIcon from '@/components/icons/AddIcon';
import { Link, useLocation } from 'react-router-dom';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import InviteIcon from '@/components/icons/InviteIcon';

function GroupHeader() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const defaultImportCover = group?.meta.cover === '0x0';
  const calm = useCalm();
  const isDark = useIsDark();

  const bgStyle = () => {
    if (
      group &&
      !isColor(group?.meta.cover) &&
      !defaultImportCover &&
      !calm.disableRemoteContent
    )
      return {
        height: '240px',
        backgroundImage: `url(${group?.meta.cover}`,
      };
    if (group && isColor(group?.meta.cover) && !defaultImportCover)
      return {
        backgroundColor: group?.meta.cover,
      };
    return {};
  };

  const fgStyle = () => {
    if (group && !isColor(group?.meta.cover) && !defaultImportCover)
      return {
        color: 'text-white dark:text-black',
        style: { textShadow: '0px 1px 3px black' },
      };
    if (group && isColor(group?.meta.cover) && !defaultImportCover) {
      const fg = foregroundFromBackground(group?.meta.cover);
      if (fg === 'white' && isDark) return { color: 'text-gray-800' };
      if (fg === 'black' && isDark) return { color: 'text-gray-50' };
      return { color: `text-${fg}` };
    }
    return { color: 'text-gray-800' };
  };

  return (
    <div
      className={cn(
        'relative mb-2 w-full rounded-lg bg-cover bg-center',
        _.isEmpty(bgStyle()) && 'bg-gray-400'
      )}
      style={bgStyle()}
    >
      <GroupActions
        className="relative cursor-pointer bg-transparent"
        flag={flag}
      >
        <SidebarItem
          highlight="#666666"
          className={cn(
            'relative pl-11',
            group && !isColor(group.meta.cover) && 'hover:bg-black/50'
          )}
          transparent={true}
          icon={<GroupAvatar {...group?.meta} />}
          {...fgStyle()}
        >
          <div className="max-w-[130px] truncate">{group?.meta.title}</div>
          <CaretDown16Icon className="absolute top-3 right-2 h-4 w-4" />
        </SidebarItem>
      </GroupActions>
      <Link
        to=".."
        className="h-6-w-6 absolute top-2.5 left-2 z-40 flex items-center justify-center rounded bg-white bg-transparent p-1 text-gray-400"
      >
        <CaretLeft16Icon className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function GroupSidebar() {
  const flag = useGroupFlag();
  const isDark = useIsDark();
  const location = useLocation();
  const isAdmin = useAmAdmin(flag);

  return (
    <nav className="flex h-full w-64 flex-none flex-col bg-white">
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-col space-y-0.5 px-2 pt-2 pb-4">
          <GroupHeader />
          <SidebarItem
            icon={
              <BellIcon
                className={cn('h-6 w-6 rounded', {
                  'mix-blend-multiply': !isDark,
                })}
              />
            }
            to={`/groups/${flag}/activity`}
          >
            Activity
          </SidebarItem>
          <SidebarItem
            icon={
              <HashIcon
                className={cn('h-6 w-6 rounded', {
                  'mix-blend-multiply': !isDark,
                })}
              />
            }
            to={`/groups/${flag}/channels`}
            className="relative"
          >
            <div className="flex w-full flex-1 items-center justify-between">
              All Channels
              {isAdmin && (
                <Link
                  to={`/groups/${flag}/channels/new`}
                  state={{ backgroundLocation: location }}
                  className="flex h-6 w-6 items-center justify-center rounded mix-blend-multiply hover:bg-gray-50 dark:mix-blend-screen"
                >
                  <AddIcon className="h-4 w-4 fill-gray-800" />
                </Link>
              )}
            </div>
          </SidebarItem>
          <SidebarItem
            to={`/groups/${flag}/invite`}
            state={{ backgroundLocation: location }}
            icon={<InviteIcon className="h-6 w-6 rounded text-blue" />}
          >
            <span className="text-blue">Invite People</span>
          </SidebarItem>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChannelList />
      </div>
    </nav>
  );
}
