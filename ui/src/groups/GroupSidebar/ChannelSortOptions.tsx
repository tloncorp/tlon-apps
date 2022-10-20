import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import useSidebarSort from '../../logic/useSidebarSort';

export default function ChannelSortOptions({
  sortOptions,
  setSortFn,
}: Omit<
  ReturnType<typeof useSidebarSort>,
  'sortFn' | 'sortChannels' | 'sortGroups' | 'sortRecordsBy'
>) {
  return (
    <DropdownMenu.Content className="dropdown w-56">
      <DropdownMenu.Item
        disabled
        className="dropdown-item flex cursor-default items-center space-x-2 text-gray-300 hover:bg-transparent"
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
  );
}
