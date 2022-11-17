import cn from 'classnames';
import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import useAllBriefs from '@/logic/useAllBriefs';
import { channelHref, nestToFlag, isChannelJoined } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup } from '@/state/groups';
import CaretDown16Icon from '@/components/icons/CaretDownIcon';
import SortIcon from '@/components/icons/SortIcon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useChannelSort from '@/logic/useChannelSort';
import { DEFAULT } from '@/logic/useSidebarSort';
import useChannelSections from '@/logic/useChannelSections';
import { GroupChannel } from '@/types/groups';
import Divider from '@/components/Divider';
import ChannelIcon from '@/channels/ChannelIcon';
import useIsChannelUnread from '@/logic/useIsChannelUnread';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import usePrefetchChannels from '@/logic/usePrefetchChannels';
import ChannelSortOptions from './ChannelSortOptions';

const UNZONED = 'default';

type ChannelSorterProps = {
  isMobile?: boolean;
};

interface ChannelListProps {
  flag: string;
  className?: string;
}

export function ChannelSorter({ isMobile }: ChannelSorterProps) {
  const { sortFn, sortOptions, setSortFn } = useChannelSort();
  return (
    <DropdownMenu.Root>
      {isMobile ? (
        <DropdownMenu.Trigger
          className="default-focus flex items-center rounded-lg p-0 text-base font-semibold"
          aria-label="Groups Sort Options"
        >
          <SortIcon className="h-6 w-6 text-gray-400" />
        </DropdownMenu.Trigger>
      ) : (
        <div className="p-2">
          <DropdownMenu.Trigger
            className="default-focus flex w-full items-center justify-between rounded-lg bg-gray-50 py-1 px-2 text-sm font-semibold"
            aria-label="Channels Sort Options"
          >
            <span className="flex items-center">
              <SortIcon className="h-4 w-4 text-gray-400" />
              <span className="mr-2 pl-1">{`Sort: ${sortFn}`}</span>
            </span>
            <CaretDown16Icon className="h-4 w-4 text-gray-400" />
          </DropdownMenu.Trigger>
        </div>
      )}
      <ChannelSortOptions sortOptions={sortOptions} setSortFn={setSortFn} />
    </DropdownMenu.Root>
  );
}

export default function ChannelList({ flag, className }: ChannelListProps) {
  const group = useGroup(flag);
  const briefs = useAllBriefs();
  const { sortFn, sortChannels } = useChannelSort();
  const isDefaultSort = sortFn === DEFAULT;
  const { sectionedChannels, sections } = useChannelSections(flag);
  const isMobile = useIsMobile();
  const { isChannelUnread } = useIsChannelUnread();

  usePrefetchChannels(flag);

  if (!group) {
    return null;
  }

  const renderChannels = (channels: [string, GroupChannel][]) =>
    channels
      .filter(([nest]) => isChannelJoined(nest, briefs))
      .map(([nest, channel]) => {
        const icon = (active: boolean) =>
          isMobile ? (
            <span
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-md',
                !active && 'bg-gray-50',
                active && 'bg-white'
              )}
            >
              <ChannelIcon nest={nest} className="h-6 w-6" />
            </span>
          ) : (
            <ChannelIcon nest={nest} className="h-6 w-6" />
          );

        return (
          <SidebarItem
            inexact
            key={nest}
            icon={icon}
            to={channelHref(flag, nest)}
            actions={isChannelUnread(nest) ? <UnreadIndicator /> : null}
          >
            {channel.meta.title || nest}
          </SidebarItem>
        );
      });

  const unsectionedChannels = sortChannels(group.channels).filter(
    ([n]) => n in briefs
  );

  return (
    <div className={className}>
      {!isMobile && <ChannelSorter isMobile={false} />}

      <ul className={cn('space-y-1', isMobile && 'flex-none space-y-3')}>
        {isDefaultSort
          ? sections.map((s) => (
              <div className="space-y-1" key={s}>
                {s !== UNZONED ? (
                  <Divider>
                    {s in group.zones ? group.zones[s].meta.title : ''}
                  </Divider>
                ) : null}
                {s in sectionedChannels
                  ? renderChannels(sectionedChannels[s])
                  : null}
              </div>
            ))
          : renderChannels(unsectionedChannels)}
      </ul>
    </div>
  );
}
