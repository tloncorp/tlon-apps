import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import SortIcon from '@/components/icons/SortIcon';
import useSidebarSort from '@/logic/useSidebarSort';
import CaretDownIcon from '@/components/icons/CaretDownIcon';

type SidebarSorterProps = Omit<
  ReturnType<typeof useSidebarSort>,
  'sortChannels' | 'sortGroups' | 'sortRecordsBy'
> & {
  isMobile: boolean;
};

export default function SidebarSorter({
  sortFn,
  sortOptions,
  setSortFn,
  isMobile,
}: SidebarSorterProps) {
  return (
    <DropdownMenu.Root>
      {isMobile ? (
        <DropdownMenu.Trigger
          className="default-focus flex items-center rounded-lg p-2 text-base font-semibold"
          aria-label="Groups Sort Options"
        >
          <h1 className="mr-4 text-xl font-medium">All Groups</h1>
          <CaretDownIcon className="h-6 w-6 text-gray-400" />
        </DropdownMenu.Trigger>
      ) : (
        <DropdownMenu.Trigger
          className="default-focus flex w-full items-center justify-between rounded-lg bg-gray-50 py-1 px-2 text-sm font-semibold"
          aria-label="Groups Sort Options"
        >
          <span className="flex items-center">
            <SortIcon className="h-4 w-4 text-gray-400" />
            <span className="mr-2 pl-1">{`Sort: ${sortFn}`}</span>
          </span>
          <CaretDown16Icon className="h-4 w-4 text-gray-400" />
        </DropdownMenu.Trigger>
      )}
      <DropdownMenu.Content className="dropdown">
        <DropdownMenu.Item
          disabled
          className="dropdown-item flex cursor-default items-center space-x-2 text-gray-300 hover:bg-transparent"
        >
          Group Ordering
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
  );
}
