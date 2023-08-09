import { useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import SortIcon from '@/components/icons/SortIcon';
import useSidebarSort from '@/logic/useSidebarSort';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import { useIsMobile } from '@/logic/useMedia';

type SidebarSorterProps = Omit<
  ReturnType<typeof useSidebarSort>,
  'sortChannels' | 'sortGroups' | 'sortRecordsBy'
>;

export default function SidebarSorter({
  sortOptions,
  setSortFn,
}: SidebarSorterProps) {
  const isMobile = useIsMobile();

  const dropdownOptions = useMemo(
    () =>
      Object.keys(sortOptions).map((k) => (
        <DropdownMenu.Item
          key={k}
          onSelect={() => setSortFn(k)}
          className="dropdown-item"
        >
          {k}
        </DropdownMenu.Item>
      )),
    [setSortFn, sortOptions]
  );

  return (
    <DropdownMenu.Root>
      {isMobile ? (
        <DropdownMenu.Trigger
          className="default-focus flex h-8 w-8 items-center rounded text-base font-semibold hover:bg-gray-50 sm:p-1"
          aria-label="Groups Sort Options"
        >
          <FilterIconMobileNav className="h-8 w-8 text-gray-900" />
        </DropdownMenu.Trigger>
      ) : (
        <DropdownMenu.Trigger
          className="default-focus flex h-6 w-6 items-center rounded text-base font-semibold hover:bg-gray-50 sm:p-1"
          aria-label="Groups Sort Options"
        >
          <SortIcon className="h-6 w-6 text-gray-400 sm:h-4 sm:w-4" />
        </DropdownMenu.Trigger>
      )}
      <DropdownMenu.Content className="dropdown w-56">
        <DropdownMenu.Item disabled className="dropdown-item-disabled">
          Group Ordering
        </DropdownMenu.Item>
        {dropdownOptions}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
