import cn from 'classnames';
import _ from 'lodash';
import { useCallback, useContext, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { foregroundFromBackground } from '@/components/Avatar';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import AddIcon from '@/components/icons/AddIcon';
import AsteriskIcon from '@/components/icons/AsteriskIcon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import HashIcon from '@/components/icons/HashIcon';
import HomeIcon from '@/components/icons/HomeIcon';
import InviteIcon from '@/components/icons/InviteIcon';
import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import ChannelList from '@/groups/GroupSidebar/ChannelList';
import { AppUpdateContext } from '@/logic/useAppUpdates';
import { useIsDark } from '@/logic/useMedia';
import { getPrivacyFromGroup, isColor } from '@/logic/utils';
import {
  useAmAdmin,
  useGang,
  useGroup,
  useGroupFlag,
} from '@/state/groups/groups';
import { useCalm } from '@/state/settings';

function GroupHeader() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const { needsUpdate } = useContext(AppUpdateContext);
  const { preview, claim } = useGang(flag);
  const defaultImportCover = useMemo(
    () => group?.meta.cover === '0x0',
    [group?.meta.cover]
  );
  const calm = useCalm();
  const isDark = useIsDark();

  const bgStyle = useCallback(() => {
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
  }, [group, defaultImportCover, calm.disableRemoteContent]);

  const fgStyle = useCallback(() => {
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
  }, [group, defaultImportCover, isDark]);

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
          <div className="max-w-[130px] truncate">
            {claim ? preview?.meta.title : group?.meta.title}
          </div>
          <CaretDown16Icon className="absolute right-2 top-3 h-4 w-4" />
        </SidebarItem>
      </GroupActions>
      <Link
        to=".."
        className={
          'h-6-w-6 absolute left-2 top-2.5 z-40 flex items-center justify-center rounded bg-transparent bg-white p-1 text-gray-400'
        }
      >
        {needsUpdate ? (
          <AsteriskIcon className="h-4 w-4 text-black dark:text-white" />
        ) : (
          <CaretLeft16Icon className="h-4 w-4" />
        )}
      </Link>
    </div>
  );
}

export default function GroupSidebar() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isDark = useIsDark();
  const location = useLocation();
  const isAdmin = useAmAdmin(flag);
  const privacy = useMemo(
    () => (group ? getPrivacyFromGroup(group) : undefined),
    [group]
  );

  return (
    <nav className="flex h-full min-w-64 flex-none flex-col bg-white">
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-col space-y-0.5 px-2 pb-4 pt-2">
          <GroupHeader />
          <SidebarItem
            icon={
              <HomeIcon
                className={cn('h-6 w-6 rounded', {
                  'mix-blend-multiply': !isDark,
                })}
              />
            }
            to={`/groups/${flag}/activity`}
          >
            Home
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
          {(privacy === 'public' || isAdmin) && (
            <SidebarItem
              to={`/groups/${flag}/invite`}
              state={{ backgroundLocation: location }}
              icon={<InviteIcon className="h-6 w-6 rounded text-blue" />}
            >
              <span className="text-blue">Invite People</span>
            </SidebarItem>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChannelList flag={flag} />
      </div>
    </nav>
  );
}
