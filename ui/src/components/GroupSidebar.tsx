import classNames from 'classnames';
import React from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ModalLocationState } from '../logic/routing';
import { useIsMobile } from '../logic/useMedia';
import { useGroup } from '../state/groups';
import { Group, GroupMeta } from '../types/groups';
import { channelHref } from '../logic/utils';
import useNavStore from './Nav/useNavStore';
import LeftIcon from './icons/LeftIcon';
import XIcon from './icons/XIcon';
import RetainedStateLink from './RetainedStateLink';
import SidebarLink from './Sidebar/SidebarLink';
import SidebarButton from './Sidebar/SidebarButton';
import CaretLeft16 from './icons/CaretLeft16';
import MagnifyingGlass from './icons/MagnifyingGlass';
import HashIcon16 from './icons/HashIcon16';
import CaretDownIcon from './icons/CaretDownIcon';
import BubbleIcon from './icons/BubbleIcon';
import useSidebarSort from '../logic/useSidebarSort';
import NotificationLink from './Sidebar/NotificationLink';

function ChannelList({ group, flag }: { group: Group; flag: string }) {
  return (
    <ul>
      {Object.entries(group.channels).map(([key, channel]) => (
        <li key={key}>
          <SidebarLink
            icon={<BubbleIcon className="h-6 w-6 p-1" />}
            to={channelHref(flag, key)}
          >
            {channel.meta.title || key}
          </SidebarLink>
        </li>
      ))}
    </ul>
  );
}

function GroupHeader({ meta }: { meta?: GroupMeta }) {
  if (!meta) {
    return null;
  }

  return (
    <li className="flex items-center space-x-3 rounded-lg p-2 text-base font-semibold">
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

  return (
    <nav
      className={classNames(
        'h-full border-r-2 border-gray-50 bg-white',
        !isMobile && 'w-64',
        isMobile && 'fixed top-0 left-0 z-40 w-full'
      )}
    >
      <div className="h-full overflow-y-auto p-2">
        <ul>
          <SidebarButton
            icon={<CaretLeft16 className="h-6 w-6" />}
            onClick={navSetMain}
          >
            All Groups
          </SidebarButton>
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

          <li>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className={'default-focus rounded-lg p-0.5 text-gray-600'}
                aria-label="Channels Sort Options"
              >
                <div className="default-focus flex items-center space-x-2 rounded-lg bg-gray-50 p-2 text-base font-semibold">
                  <span className="pl-1">{`Channels: ${sortFn}`}</span>
                  <CaretDownIcon className="w-4 text-gray-400" />
                </div>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="dropdown">
                <DropdownMenu.Item
                  disabled
                  className="dropdown-item flex items-center space-x-2 text-gray-300"
                >
                  Channel Ordering
                </DropdownMenu.Item>
                {Object.keys(sortOptions).map((k) => (
                  <DropdownMenu.Item
                    key={k}
                    onSelect={() => setSortFn(k)}
                    className="dropdown-item flex items-center space-x-2"
                  >
                    {k}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </li>
        </ul>
        {group ? <ChannelList group={group} flag={flag} /> : null}
      </div>
    </nav>
  );
}
