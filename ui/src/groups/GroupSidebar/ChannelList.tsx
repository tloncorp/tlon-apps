import cn from 'classnames';
import React, { useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import useAllBriefs from '@/logic/useAllBriefs';
import { channelHref, nestToFlag } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup } from '@/state/groups';
import useNavStore from '@/components/Nav/useNavStore';
import CaretDownIcon from '@/components/icons/CaretDownIcon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useChannelSort from '@/logic/useChannelSort';
import { DEFAULT } from '@/logic/useSidebarSort';
import useChannelSections from '@/logic/useChannelSections';
import { GroupChannel } from '@/types/groups';
import Divider from '@/components/Divider';
import ChannelIcon from '@/channels/ChannelIcon';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import { useNotifications } from '@/notifications/useNotifications';
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
  const { isChannelUnread } = useNotifications(flag);

  const hide = useCallback(() => {
    if (isMobile) {
      navPrimary('hidden');
    }
  }, [navPrimary, isMobile]);

  if (!group) {
    return null;
  }

  const renderChannels = (channels: [string, GroupChannel][]) =>
    channels.map(([nest, channel]) => {
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
          key={nest}
          icon={icon}
          to={channelHref(flag, nest)}
          onClick={hide}
          actions={
            isChannelUnread(chFlag) ? (
              <ActivityIndicator
                count={0}
                bg={'transparent'}
                className="text-blue"
              />
            ) : null
          }
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
        {isDefaultSort
          ? sections.map((s) => (
              <div key={s}>
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
