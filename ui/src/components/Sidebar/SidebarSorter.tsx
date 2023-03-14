import React, { useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import SortIcon from '@/components/icons/SortIcon';
import useSidebarSort from '@/logic/useSidebarSort';

type SidebarSorterProps = Omit<
  ReturnType<typeof useSidebarSort>,
  'sortChannels' | 'sortGroups' | 'sortRecordsBy'
>;

export default function SidebarSorter({
  sortOptions,
  setSortFn,
}: SidebarSorterProps) {
  const dropdownOptions = useMemo(
    () =>
      Object.keys(sortOptions).map((k) => (
        <DropdownMenu.Item
          key={k}
          onSelect={() => setSortFn(k)}
          className="dropdown-item flex items-center space-x-2"
        >
          {k}
        </DropdownMenu.Item>
      )),
    [setSortFn, sortOptions]
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="default-focus flex h-6 w-6 items-center rounded text-base font-semibold hover:bg-gray-50"
        aria-label="Groups Sort Options"
      >
        <SortIcon className="m-1 h-4 w-4 text-gray-400" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="dropdown w-56">
        <DropdownMenu.Item
          disabled
          className="dropdown-item flex cursor-default items-center space-x-2 text-gray-300 hover:bg-transparent"
        >
          Group Ordering
        </DropdownMenu.Item>
        {dropdownOptions}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
