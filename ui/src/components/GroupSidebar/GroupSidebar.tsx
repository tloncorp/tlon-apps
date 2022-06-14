import cn from 'classnames';
import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useIsMobile } from '../../logic/useMedia';
import { useGroup } from '../../state/groups';
import { GroupMeta } from '../../types/groups';
import useNavStore from '../Nav/useNavStore';
import SidebarLink from '../Sidebar/SidebarLink';
import CaretLeft16Icon from '../icons/CaretLeft16Icon';
import MagnifyingGlass from '../icons/MagnifyingGlass';
import HashIcon16 from '../icons/HashIcon16';
import CaretDownIcon from '../icons/CaretDown16Icon';
import useSidebarSort from '../../logic/useSidebarSort';
import NotificationLink from '../Sidebar/NotificationLink';
import ChannelSortOptions from './ChannelSortOptions';
import MobileGroupSidebar from './MobileGroupSidebar';
import ChannelList from './ChannelList';

function GroupHeader({ meta }: { meta?: GroupMeta }) {
  if (!meta) {
    return null;
  }

  return (
    <li className="flex items-center space-x-3 rounded-lg p-2 text-base font-semibold text-gray-600">
      {(meta?.image || '').length > 0 ? (
        <img
          className="h-6 w-6 rounded border-2 border-transparent"
          src={meta?.image}
        />
      ) : (
        <div className="h-6 w-6 rounded border-2 border-gray-100" />
      )}
      <h3>{meta?.title}</h3>
    </li>
  );
}

export default function GroupSidebar() {
  const flag = useNavStore((state) => state.flag);
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const navSetMain = useNavStore((state) => state.setLocationMain);
  const { sortFn, setSortFn, sortOptions } = useSidebarSort();
  // TODO: get activity count from hark store
  const activityCount = 0;

  if (isMobile) {
    return <MobileGroupSidebar />;
  }

  return (
    <nav className="h-full w-64 border-r-2 border-gray-50 bg-white">
      <header className="px-2 py-1">
        <button
          className="default-focus flex w-full items-center rounded-lg p-2 text-base font-semibold text-gray-600 hover:bg-gray-50"
          onClick={navSetMain}
        >
          <CaretLeft16Icon className="h-6 w-6 text-gray-400" />
          All Groups
        </button>
      </header>
      <div className="h-full overflow-y-auto p-2">
        <ul>
          <GroupHeader meta={group?.meta} />
          <NotificationLink
            count={activityCount}
            title={'Activity'}
            to={`/groups/${flag}/activity`}
          />
          <SidebarLink
            icon={<MagnifyingGlass className="h-6 w-6" />}
            to={`/groups/${flag}/search`}
          >
            Find in Group
          </SidebarLink>
          <SidebarLink
            icon={<HashIcon16 className="h-6 w-6" />}
            to={`/groups/${flag}/all`}
          >
            All Channels
          </SidebarLink>
          <li className="my-1">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className={cn(
                  'default-focus rounded-lg p-2 text-gray-600',
                  isMobile && 'mt-2 mb-3'
                )}
                aria-label="Channels Sort Options"
              >
                <div className="default-focus flex items-center space-x-2 rounded-lg bg-gray-50 p-2 text-base font-semibold">
                  <span className="pl-1">{`Channels: ${sortFn}`}</span>
                  <CaretDownIcon className="w-4 text-gray-400" />
                </div>
              </DropdownMenu.Trigger>
              <ChannelSortOptions
                sortOptions={sortOptions}
                setSortFn={setSortFn}
              />
            </DropdownMenu.Root>
          </li>
        </ul>
        <ChannelList flag={flag} />
      </div>
    </nav>
  );
}
