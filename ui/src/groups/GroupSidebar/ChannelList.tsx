import cn from 'classnames';
import React, { useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useIsMobile } from '../../logic/useMedia';
import { channelHref } from '../../logic/utils';
import { useGroup } from '../../state/groups';
import BubbleIcon from '../../components/icons/BubbleIcon';
import useNavStore from '../../components/Nav/useNavStore';
import CaretDownIcon from '../../components/icons/CaretDownIcon';
import ChannelSortOptions from './ChannelSortOptions';
import useSidebarSort from '../../logic/useSidebarSort';
import SidebarItem from '../../components/Sidebar/SidebarItem';

interface ChannelListProps {
  flag: string;
  className?: string;
}

export default function ChannelList({ flag, className }: ChannelListProps) {
  const isMobile = useIsMobile();
  const group = useGroup(flag);
  const { sortFn, sortOptions, setSortFn } = useSidebarSort();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const hide = useCallback(() => {
    if (isMobile) {
      navPrimary('hidden');
    }
  }, [navPrimary, isMobile]);

  if (!group) {
    return null;
  }

  const icon = (active: boolean) =>
    isMobile ? (
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-md',
          !active && 'bg-gray-50',
          active && 'bg-white'
        )}
      >
        <BubbleIcon className="h-6 w-6" />
      </span>
    ) : (
      <BubbleIcon className="h-6 w-6" />
    );

  return (
    <div className={className}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="default-focus mt-2 mb-3 rounded-lg p-2 text-gray-600 sm:m-0"
          aria-label="Channels Sort Options"
        >
          <div className="default-focus flex items-center space-x-2 rounded-lg bg-gray-50 p-2 text-base font-semibold">
            <span className="pl-1">{`Channels: ${sortFn}`}</span>
            <CaretDownIcon className="w-4 text-gray-400" />
          </div>
        </DropdownMenu.Trigger>
        <ChannelSortOptions sortOptions={sortOptions} setSortFn={setSortFn} />
      </DropdownMenu.Root>
      <ul className={cn(isMobile && 'space-y-3')}>
        {Object.entries(group.channels).map(([key, channel]) => (
          <SidebarItem
            key={key}
            icon={icon}
            to={channelHref(flag, key)}
            onClick={hide}
          >
            {channel.meta.title || key}
          </SidebarItem>
        ))}
      </ul>
    </div>
  );
}
