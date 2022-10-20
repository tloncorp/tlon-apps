import cn from 'classnames';
import React, { useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import useAllBriefs from '@/logic/useAllBriefs';
import { channelHref, nestToFlag, filterJoinedChannels } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup } from '@/state/groups';
import useNavStore from '@/components/Nav/useNavStore';
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
import ChannelSortOptions from './ChannelSortOptions';

const UNZONED = 'default';
interface ChannelListProps {
  flag: string;
  className?: string;
}

export default function ChannelList({ flag, className }: ChannelListProps) {
  const group = useGroup(flag);
  const briefs = useAllBriefs();
  const { sortFn, sortOptions, setSortFn, sortChannels } = useChannelSort();
  const isDefaultSort = sortFn === DEFAULT;
  const { sectionedChannels, sections } = useChannelSections(flag);
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const { isChannelUnread } = useIsChannelUnread(flag);

  const hide = useCallback(() => {
    if (isMobile) {
      navPrimary('hidden');
    }
  }, [navPrimary, isMobile]);

  if (!group) {
    return null;
  }

  const renderChannels = (channels: [string, GroupChannel][]) =>
    filterJoinedChannels(channels, briefs).map(([nest, channel]) => {
      const [_app, chFlag] = nestToFlag(nest);
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
          onClick={hide}
          actions={isChannelUnread(chFlag) ? <UnreadIndicator /> : null}
        >
          {channel.meta.title || nest}
        </SidebarItem>
      );
    });

  const unsectionedChannels = sortChannels(group.channels).filter(([n]) => {
    const [_app, f] = nestToFlag(n);
    return f in briefs;
  });

  return (
    <div className={className}>
      <DropdownMenu.Root>
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
        <ChannelSortOptions sortOptions={sortOptions} setSortFn={setSortFn} />
      </DropdownMenu.Root>
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
