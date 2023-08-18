import { useState, useEffect } from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import ChannelHeader from '@/channels/ChannelHeader';
import SortIcon from '@/components/icons/SortIcon';
import {
  HeapSetting,
  setChannelSetting,
  useHeapSettings,
  usePutEntryMutation,
} from '@/state/settings';
import { HeapDisplayMode, HeapSortMode } from '@/types/heap';
import { nestToFlag } from '@/logic/utils';
import { useLeaveHeapMutation } from '@/state/heap/heap';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import ActionMenu, { Action } from '@/components/ActionMenu';
import { useIsMobile } from '@/logic/useMedia';
import AddCurioModal from './AddCurioModal';

interface HeapHeaderProps {
  flag: string;
  nest: string;
  display: HeapDisplayMode;
  sort: HeapSortMode;
  canWrite: boolean;
  draggedFile: File | null;
  clearDraggedFile: () => void;
}

const HeapHeader = React.memo(
  ({
    flag,
    nest,
    display,
    sort,
    canWrite,
    draggedFile,
    clearDraggedFile,
  }: HeapHeaderProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [addCurioOpen, setAddCurioOpen] = useState(false);
    const isMobile = useIsMobile();
    const [, chFlag] = nestToFlag(nest);
    const settings = useHeapSettings();
    const { mutate } = usePutEntryMutation({
      bucket: 'heaps',
      key: 'heapSettings',
    });
    const leaveHeapMutation = useLeaveHeapMutation();

    const setDisplayMode = (setting: HeapDisplayMode) => {
      const newSettings = setChannelSetting<HeapSetting>(
        settings,
        { displayMode: setting },
        chFlag
      );

      mutate({
        val: JSON.stringify(newSettings),
      });
    };

    const setSortMode = (setting: HeapSortMode) => {
      const newSettings = setChannelSetting<HeapSetting>(
        settings,
        { sortMode: setting },
        chFlag
      );

      mutate({
        val: JSON.stringify(newSettings),
      });
    };

    const actions: Action[] = [
      {
        content: 'Display: List',
        key: 'display-list',
        onClick: () => (setDisplayMode ? setDisplayMode('list') : null),
        type: display === 'list' ? 'prominent' : 'default',
      },
      {
        content: 'Display: Grid',
        key: 'display-grid',
        onClick: () => (setDisplayMode ? setDisplayMode('grid') : null),
        type: display === 'grid' ? 'prominent' : 'default',
      },
      {
        content: 'Sort: New Posts First',
        key: 'sort-time-dsc',
        onClick: () => (setSortMode ? setSortMode('time') : null),
        type: sort === 'time' ? 'prominent' : 'default',
      },
      {
        content: 'Sort: Alphabetical',
        key: 'sort-time-asc',
        onClick: () => (setSortMode ? setSortMode('alpha') : null),
        type: sort === 'alpha' ? 'prominent' : 'default',
      },
    ];

    return (
      <ChannelHeader
        flag={flag}
        nest={nest}
        prettyAppName="Gallery"
        leave={(leaveFlag: string) =>
          leaveHeapMutation.mutateAsync({ flag: leaveFlag })
        }
      >
        <div className="flex h-12 items-center justify-end space-x-2 sm:h-auto">
          <ActionMenu actions={actions} open={isOpen} onOpenChange={setIsOpen}>
            <button>
              {isMobile ? (
                <FilterIconMobileNav className="mt-0.5 h-8 w-8 text-gray-900" />
              ) : (
                <SortIcon className="h-6 w-6 text-gray-600" />
              )}
            </button>
          </ActionMenu>
        </div>
        <AddCurioModal
          open={addCurioOpen}
          setOpen={setAddCurioOpen}
          flag={flag}
          chFlag={chFlag}
          draggedFile={draggedFile}
          clearDraggedFile={clearDraggedFile}
        />
        {/* <button
          className="button"
          onClick={() => setAddCurioOpen(true)}
          disabled={addCurioOpen}
          hidden={!canWrite}
        >
          New Block
        </button> */}
      </ChannelHeader>
    );
  }
);

export default HeapHeader;
