import React, { useCallback, useState } from 'react';

import ActionMenu, { Action } from '@/components/ActionMenu';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import SortIcon from '@/components/icons/SortIcon';
import { useIsMobile } from '@/logic/useMedia';
import useSidebarSort from '@/logic/useSidebarSort';

type SidebarSorterProps = Omit<
  ReturnType<typeof useSidebarSort>,
  'sortChannels' | 'sortGroups' | 'sortRecordsBy'
>;

const SidebarSorter = React.memo(
  ({ sortOptions, sortFn, setSortFn }: SidebarSorterProps) => {
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);

    const renderIcon = useCallback(() => {
      if (isMobile) {
        return <FilterIconMobileNav className="h-8 w-8 text-gray-900" />;
      }

      return <SortIcon className="h-6 w-6 text-gray-400 sm:h-4 sm:w-4" />;
    }, [isMobile]);

    const actions: Action[] = [];

    if (!isMobile) {
      actions.push({
        key: 'ordering',
        type: 'disabled',
        content: 'Group Ordering',
      });
    }

    Object.keys(sortOptions).forEach((k) => {
      actions.push({
        key: k,
        type: k === sortFn ? 'prominent' : 'default',
        onClick: () => setSortFn(k),
        content: k,
      });
    });

    return (
      <ActionMenu
        open={open}
        onOpenChange={setOpen}
        actions={actions}
        asChild={false}
        triggerClassName="default-focus flex items-center rounded text-base font-semibold hover:bg-gray-50 sm:p-1"
        contentClassName="w-56"
        ariaLabel="Groups Sort Options"
      >
        {renderIcon()}
      </ActionMenu>
    );
  }
);

export default SidebarSorter;
