import cn from 'classnames';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { FastAverageColor } from 'fast-average-color';
import { mix, transparentize } from 'color2k';
import { useIsDark } from '@/logic/useMedia';
import { useAmAdmin, useGroup, useGroupFlag } from '@/state/groups/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import BellIcon from '@/components/icons/BellIcon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useHarkState from '@/state/hark';
import { useCalm } from '@/state/settings';
import { isColor } from '@/logic/utils';
import { foregroundFromBackground } from '@/components/Avatar';
import ChannelList from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import GroupActions from '@/groups/GroupActions';
import HashIcon from '@/components/icons/HashIcon';
import AddIcon from '@/components/icons/AddIcon';
import { Link, useLocation } from 'react-router-dom';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import { useSubscriptionStatus } from '@/state/local';

function GroupHeader() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const [groupCoverHover, setGroupCoverHover] = useState(false);
  const [noCors, setNoCors] = useState(false);
  const [coverImgColor, setCoverImgColor] = useState('');
  const cover = useRef(null);
  const fac = new FastAverageColor();
  const averageSucceeded = isColor(coverImgColor);
  const dark = useIsDark();
  const hoverFallbackForeground = dark ? 'white' : 'black';
  const hoverFallbackBackground = dark ? '#333333' : '#CCCCCC';
  const calm = useCalm();
  const defaultImportCover = group?.meta.cover === '0x0';
  const { subscription } = useSubscriptionStatus();

  const onError = useCallback(() => {
    setNoCors(true);
  }, []);

  const getCoverImageColor = () => {
    fac
      .getColorAsync(cover.current)
      .then((color) => {
        setCoverImgColor(color.hex);
      })
      .catch(() => null);
  };

  const coverStyles = () => {
    if (group && isColor(group.meta.cover)) {
      return {
        backgroundColor: group.meta.cover,
      };
    }
    if (group && defaultImportCover) {
      return {
        backgroundColor: '#D9D9D9',
      };
    }
    return {};
  };

  const coverButtonStyles = () => {
    if (group && defaultImportCover) {
      return {
        backgroundColor:
          groupCoverHover === true
            ? mix('#D9D9D9', 'black', 0.33)
            : 'transparent',
        color: foregroundFromBackground('#D9D9D9'),
      };
    }
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
        color: averageSucceeded
          ? foregroundFromBackground(coverImgColor)
          : hoverFallbackForeground,
        backgroundColor:
          groupCoverHover === true
            ? transparentize(
                averageSucceeded ? coverImgColor : hoverFallbackBackground,
                0.33
              )
            : 'transparent',
      };
    }
    return {};
  };

  const coverTitleStyles = () => {
    if (group && isColor(group.meta.cover))
      return {
        color: foregroundFromBackground(group.meta.cover),
      };
    return {
      color: averageSucceeded
        ? foregroundFromBackground(coverImgColor)
        : hoverFallbackForeground,
    };
  };

  return (
    <div className="relative mb-2 w-full rounded-lg" style={coverStyles()}>
      {group &&
        !calm?.disableRemoteContent &&
        !isColor(group?.meta.cover) &&
        !defaultImportCover && (
          <img
            {...(noCors ? {} : { crossOrigin: 'anonymous' })}
            src={group?.meta.cover}
            ref={cover}
            onError={onError}
            onLoad={() => getCoverImageColor()}
            className="absolute h-full w-full flex-none rounded-lg object-cover"
          />
        )}
      {group &&
        calm.disableRemoteContent &&
        !isColor(group?.meta.cover) &&
        !defaultImportCover && (
          <div className="absolute h-full w-full flex-none rounded-lg bg-gray-400" />
        )}
      <div
        style={
          group && !isColor(group?.meta.cover) && !defaultImportCover
            ? { height: '240px' }
            : {}
        }
        className="group relative mb-2 flex w-full flex-col justify-between text-lg font-semibold text-gray-600 sm:text-base"
      >
        <SidebarItem
          icon={
            <CaretLeft16Icon
              className={cn(
                'm-1 h-4 w-4',
                !averageSucceeded &&
                  dark &&
                  'drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
              )}
            />
          }
          to="/"
          onMouseEnter={() => setGroupCoverHover(true)}
          onMouseLeave={() => setGroupCoverHover(false)}
          highlight="hover:bg-transparent"
          style={coverButtonStyles()}
          div
        >
          {groupCoverHover && <span>Back to Groups</span>}
        </SidebarItem>
        <GroupActions flag={flag} className="">
          <button className="group flex w-full items-center space-x-3 rounded-lg p-2 font-semibold focus:outline-none">
            <GroupAvatar {...group?.meta} />
            <div
              title={group?.meta.title}
              style={coverTitleStyles()}
              className={cn(
                'max-w-full flex-1 truncate text-left',
                coverTitleStyles().color === 'white' &&
                  'drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
              )}
            >
              {group?.meta.title}
            </div>

            <div style={coverTitleStyles()}>
              {subscription === 'reconnecting' ? (
                <LoadingSpinner
                  fill={`fill-${coverTitleStyles().color}`}
                  primary={`fill-${coverTitleStyles().color}`}
                  secondary={`fill-${coverTitleStyles().color} opacity-25`}
                  className="h-4 w-4 group-hover:hidden"
                />
              ) : null}
              <CaretDown16Icon
                aria-label="Open Menu"
                className={cn('hidden h-4 w-4 group-hover:block')}
              />
            </div>
          </button>
        </GroupActions>
      </div>
    </div>
  );
}

export default function GroupSidebar() {
  const flag = useGroupFlag();
  const isDark = useIsDark();
  const location = useLocation();
  const isAdmin = useAmAdmin(flag);

  useEffect(() => {
    if (flag !== '') {
      useHarkState.getState().retrieveGroup(flag);
    }
    return () => {
      useHarkState.getState().releaseGroup(flag);
    };
  }, [flag]);

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
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChannelList />
      </div>
    </nav>
  );
}
