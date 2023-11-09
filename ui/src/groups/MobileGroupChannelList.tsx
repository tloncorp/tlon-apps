import React from 'react';
import cn from 'classnames';
import { Link, useLocation } from 'react-router-dom';
import { useGroupFlag, useGroup, useAmAdmin } from '@/state/groups';
import ChannelList, { ChannelSorter } from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import HostConnection from '@/channels/HostConnection';
import { getFlagParts, isColor } from '@/logic/utils';
import { useConnectivityCheck } from '@/state/vitals';
import MobileHeader from '@/components/MobileHeader';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import { useCalm } from '@/state/settings';
import { useIsDark } from '@/logic/useMedia';
import { foregroundFromBackground } from '@/components/Avatar';
import GroupActions from './GroupActions';

export default function MobileGroupChannelList() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const saga = group?.saga || null;
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
        color: 'white',
        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
      };

    if (group && isColor(group?.meta.cover) && !defaultImportCover) {
      const fg = foregroundFromBackground(group?.meta.cover);
      if (fg === 'white' && isDark) return { color: 'black' };
      if (fg === 'black' && isDark) return { color: 'white' };
      return { color: fg };
    }
    return { color: '#333' };
  };

  return (
    <>
      <MobileHeader
        className="!bg-transparent"
        title={
          <GroupActions flag={flag} saga={saga} status={data?.status}>
            <button className="flex w-full flex-col items-center">
              <GroupAvatar image={group?.meta.image} className="mt-3" />
              <div className="relative my-1 flex w-max items-center justify-center space-x-1">
                <h1
                  className={cn('max-w-xs truncate text-base')}
                  style={fgStyle()}
                >
                  {group?.meta.title}
                </h1>
                <HostConnection
                  ship={host}
                  status={data?.status}
                  saga={saga}
                  type="bullet"
                />
              </div>
            </button>
          </GroupActions>
        }
        action={
          <div className="flex h-12 items-center justify-end space-x-2">
            <ReconnectingSpinner />
            <ChannelSorter isMobile={true} />
            {isAdmin && (
              <Link
                className="default-focus flex text-base"
                to={`/groups/${flag}/channels/new`}
                state={{ backgroundLocation: location }}
              >
                <AddIconMobileNav className="h-8 w-8 text-black" />
              </Link>
            )}
          </div>
        }
        pathBack="/"
      />
      <div className="relative z-10 mt-2 h-full rounded-t-3xl bg-white pb-4 drop-shadow-[0_-2px_4px_rgba(0,0,0,0.125)]">
        <ChannelList paddingTop={6} />
      </div>
      <div
        className="absolute top-[-5%] left-[-5%] -z-10 h-64 w-[110%] bg-cover bg-center mix-blend-multiply blur-md dark:mix-blend-screen"
        style={bgStyle()}
      />
    </>
  );
}
