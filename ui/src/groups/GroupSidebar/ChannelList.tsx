import cn from 'classnames';
import React, { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import useAllBriefs from '@/logic/useAllBriefs';
import {
  channelHref,
  isChannelJoined,
  canReadChannel,
  nestToFlag,
  getFlagParts,
  isChannelImported,
} from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup, useVessel } from '@/state/groups';
import CaretDown16Icon from '@/components/icons/CaretDownIcon';
import SortIcon from '@/components/icons/SortIcon';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useChannelSort from '@/logic/useChannelSort';
import { DEFAULT } from '@/logic/useSidebarSort';
import useChannelSections from '@/logic/useChannelSections';
import { GroupChannel } from '@/types/groups';
import Divider from '@/components/Divider';
import ChannelIcon from '@/channels/ChannelIcon';
import { useCheckChannelUnread } from '@/logic/useIsChannelUnread';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import usePendingImports from '@/logic/usePendingImports';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import HashIcon16 from '@/components/icons/HashIcon16';
import MigrationTooltip from '@/components/MigrationTooltip';
import { useStartedMigration } from '@/logic/useMigrationInfo';
import useFilteredSections from '@/logic/useFilteredSections';
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

interface UnmigratedChannelProps {
  icon: ReactNode;
  title: string;
  host: string;
  isMobile: boolean;
}

function UnmigratedChannel({
  icon,
  host,
  title,
  isMobile,
}: UnmigratedChannelProps) {
  return (
    <MigrationTooltip ship={host} side="right">
      <SidebarItem
        icon={icon}
        actions={
          <Bullet16Icon className="m-2 h-4 w-4 text-orange opacity-60" />
        }
      >
        <span className="opacity-60">{title}</span>
      </SidebarItem>
    </MigrationTooltip>
  );
}

export default function ChannelList({ flag, className }: ChannelListProps) {
  const group = useGroup(flag);
  const briefs = useAllBriefs();
  const pendingImports = usePendingImports();
  const { hasStarted } = useStartedMigration(flag);
  const { sortFn, sortChannels } = useChannelSort();
  const isDefaultSort = sortFn === DEFAULT;
  const { sectionedChannels } = useChannelSections(flag);
  const filteredSections = useFilteredSections(flag, true);
  const isMobile = useIsMobile();
  const vessel = useVessel(flag, window.our);
  const isChannelUnread = useCheckChannelUnread();

  if (!group) {
    return null;
  }

  const renderChannels = (channels: [string, GroupChannel][]) =>
    channels
      .filter(
        ([nest, chan]) =>
          (isChannelJoined(nest, briefs) &&
            canReadChannel(chan, vessel, group?.bloc)) ||
          nest in pendingImports
      )
      .map(([nest, channel]) => {
        const [, chFlag] = nestToFlag(nest);
        const { ship } = getFlagParts(chFlag);
        const imported =
          isChannelImported(nest, pendingImports) && hasStarted(ship);
        const icon = (active: boolean) =>
          isMobile ? (
            <span
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-md',
                !imported && 'opacity-60',
                !active && 'bg-gray-50',
                active && 'bg-white'
              )}
            >
              <ChannelIcon nest={nest} className="h-6 w-6" />
            </span>
          ) : (
            <ChannelIcon
              nest={nest}
              className={cn('h-6 w-6', !imported && 'opacity-60')}
            />
          );

        if (!imported) {
          return (
            <UnmigratedChannel
              icon={icon}
              title={channel.meta.title || nest}
              host={ship}
              isMobile={isMobile}
            />
          );
        }

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
      {isMobile && (
        <SidebarItem
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
              <HashIcon16 className="m-1 h-4 w-4" />
            </div>
          }
          to={`/groups/${flag}/channels`}
          className="mb-3"
        >
          All Channels
        </SidebarItem>
      )}
      {!isMobile && <ChannelSorter isMobile={false} />}
      <ul className={cn('space-y-1', isMobile && 'flex-none space-y-3')}>
        {isDefaultSort
          ? filteredSections.map((s) => (
              <div className="space-y-1" key={s}>
                {s !== UNZONED ? (
                  <Divider>
                    {s in group.zones ? group.zones[s].meta.title : ''}
                  </Divider>
                ) : null}
                {renderChannels(sectionedChannels[s])}
              </div>
            ))
          : renderChannels(unsectionedChannels)}
      </ul>
    </div>
  );
}
