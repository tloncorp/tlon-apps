import cn from 'classnames';
import React from 'react';
import { useGroup } from '../../state/groups';
import GroupAvatar from '../GroupAvatar';
import CaretLeftIcon from '../icons/CaretLeftIcon';
import HashIcon from '../icons/HashIcon';
import MagnifyingGlass from '../icons/MagnifyingGlassIcon';
import useNavStore from '../Nav/useNavStore';
import NavTab from '../NavTab';
import ActivityIndicator from '../Sidebar/ActivityIndicator';
import ChannelList from './ChannelList';

export default function MobileGroupSidebar() {
  const { navSetMain, flag, secondary } = useNavStore((state) => ({
    navSetMain: state.setLocationMain,
    flag: state.flag,
    secondary: state.secondary,
  }));
  const group = useGroup(flag);
  // TODO: get activity count from hark store
  const activityCount = 0;

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col overflow-x-hidden border-r-2 border-gray-50 bg-white">
      <header className="px-2 py-1">
        <button
          className="default-focus inline-flex items-center rounded-lg p-2 text-xl font-medium text-gray-800 hover:bg-gray-50"
          onClick={navSetMain}
        >
          <CaretLeftIcon className="mr-4 h-6 w-6 text-gray-400" />
          {secondary === 'main'
            ? 'Channels'
            : secondary === 'notifications'
            ? 'Notifications'
            : secondary === 'search'
            ? 'Search Channels'
            : secondary === 'group'
            ? 'Group'
            : null}
        </button>
      </header>
      <div className="h-full w-full overflow-y-auto p-2">
        {secondary === 'main' ? (
          <ChannelList flag={flag} />
        ) : secondary === 'notifications' ? (
          <div />
        ) : secondary === 'search' ? (
          <div />
        ) : secondary === 'group' ? (
          <div />
        ) : null}
      </div>
      <footer className="mt-auto border-t-2 border-gray-50">
        <nav>
          <ul className="flex items-center">
            <NavTab loc="main" current={secondary}>
              <HashIcon className="h-6 w-6" />
              Channels
            </NavTab>
            <NavTab loc="group" current={secondary}>
              <GroupAvatar
                img={group?.meta.image}
                className={cn(secondary !== 'group' && 'opacity-50')}
              />
              Group
            </NavTab>
            <NavTab loc="notifications" current={secondary}>
              <ActivityIndicator count={activityCount} />
              Activity
            </NavTab>
            <NavTab loc="search" current={secondary}>
              <MagnifyingGlass className="h-6 w-6" />
              Find
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
