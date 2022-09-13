import React, { useEffect, useState, useRef } from 'react';
import { FastAverageColor } from 'fast-average-color';
import { mix, transparentize } from 'color2k';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import { useGroup } from '@/state/groups/groups';
import useNavStore from '@/components/Nav/useNavStore';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import HashIcon16 from '@/components/icons/HashIcon16';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useHarkState from '@/state/hark';
import { isColor } from '@/logic/utils';
import { foregroundFromBackground } from '@/components/Avatar';
import MobileGroupSidebar from './MobileGroupSidebar';
import ChannelList from './ChannelList';
import GroupAvatar from '../GroupAvatar';
import GroupActions from '../GroupActions';

function GroupHeader() {
  const flag = useNavStore((state) => state.flag);
  const group = useGroup(flag);
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const [groupCoverHover, setGroupCoverHover] = useState(false);
  const [coverImgColor, setCoverImgColor] = useState('');
  const cover = useRef(null);
  const fac = new FastAverageColor();
  const dark = useMedia('(prefers-color-scheme: dark)');
  const hoverFallbackForeground = dark ? 'white' : 'black';
  const hoverFallbackBackground = dark ? '#333333' : '#CCCCCC';

  const getCoverImageColor = () => {
    fac
      .getColorAsync(cover.current)
      .then((color) => {
        setCoverImgColor(color.hex);
      })
      .catch(() => null);
  };

  const coverStyles = () => {
    if (group && isColor(group.meta.cover))
      return {
        backgroundColor: group.meta.cover,
      };
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
    // debugger;
    if (group && !isColor(group.meta.cover)) {
      return {
        color: isColor(coverImgColor)
          ? foregroundFromBackground(coverImgColor)
          : hoverFallbackForeground,
        backgroundColor:
          groupCoverHover === true
            ? transparentize(
                isColor(coverImgColor)
                  ? coverImgColor
                  : hoverFallbackBackground,
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
    return { color: foregroundFromBackground(coverImgColor) };
  };

  return (
    <li className="relative mb-2 w-full rounded-lg" style={coverStyles()}>
      {group && !isColor(group?.meta.cover) && (
        <img
          src={group?.meta.cover}
          ref={cover}
          crossOrigin="anonymous"
          onLoad={() => getCoverImageColor()}
          className="absolute h-full w-full flex-none rounded-lg object-cover"
        />
      )}
      <div
        style={group && !isColor(group?.meta.cover) ? { height: '240px' } : {}}
        className="group relative mb-2 flex w-full flex-col justify-between text-lg font-semibold text-gray-600 sm:text-base"
      >
        <SidebarItem
          icon={<CaretLeft16Icon className="m-1 h-4 w-4" />}
          to="/"
          onClick={() => navPrimary('main')}
          onMouseEnter={() => setGroupCoverHover(true)}
          onMouseLeave={() => setGroupCoverHover(false)}
          highlight="hover:bg-transparent"
          style={coverButtonStyles()}
          div
        >
          {groupCoverHover && <span>Back to Groups</span>}
        </SidebarItem>
        <GroupActions flag={flag} className="">
          <button className="default-focus flex w-full items-center space-x-3 rounded-lg p-2 pr-4 font-semibold">
            <GroupAvatar {...group?.meta} />
            <div
              title={group?.meta.title}
              style={coverTitleStyles()}
              className="max-w-full flex-1 truncate text-left"
            >
              {group?.meta.title}
            </div>
          </button>
        </GroupActions>
      </div>
    </li>
  );
}

export default function GroupSidebar() {
  const flag = useNavStore((state) => state.flag);
  const group = useGroup(flag);
  const isMobile = useIsMobile();

  useEffect(() => {
    useHarkState.getState().retrieveGroup(flag);
    return () => {
      useHarkState.getState().releaseGroup(flag);
    };
  }, [flag]);

  if (isMobile) {
    return <MobileGroupSidebar />;
  }

  if (group) {
    return (
      <nav className="flex h-full w-64 flex-none flex-col bg-white">
        <div className="h-5" />
        <div className="flex min-h-0 flex-col px-2">
          <ul>
            <GroupHeader />
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

  return null;
}
