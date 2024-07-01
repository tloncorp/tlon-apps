import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { DisplayMode, SortMode } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';

import ChannelHeader from '@/channels/ChannelHeader';
import DisplayDropdown from '@/channels/DisplayDropdown';
import ActionMenu, { Action } from '@/components/ActionMenu';
import Tooltip from '@/components/Tooltip';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import SortIcon from '@/components/icons/SortIcon';
import { useChannelCompatibility } from '@/logic/channel';
import { useIsMobile } from '@/logic/useMedia';
import { nestToFlag } from '@/logic/utils';
import { useLeaveMutation } from '@/state/channel/channel';
import {
  HeapSetting,
  setChannelSetting,
  useHeapSettings,
  usePutEntryMutation,
} from '@/state/settings';

import AddCurioModal from './AddCurioModal';

interface HeapHeaderProps {
  groupFlag: string;
  nest: string;
  display: DisplayMode;
  sort: SortMode;
  canWrite?: boolean;
  draggedFile: File | null;
  clearDragState: () => void;
  addCurioOpen: boolean;
  setAddCurioOpen: (open: boolean) => void;
  dragErrorMessage?: string;
}

const HeapHeader = React.memo(
  ({
    groupFlag,
    nest,
    display,
    sort,
    canWrite,
    draggedFile,
    clearDragState,
    addCurioOpen,
    setAddCurioOpen,
    dragErrorMessage,
  }: HeapHeaderProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();
    const [, chFlag] = nestToFlag(nest);
    const settings = useHeapSettings();
    const { compatible, text } = useChannelCompatibility(`heap/${chFlag}`);
    const { mutate } = usePutEntryMutation({
      bucket: 'heaps',
      key: 'heapSettings',
    });

    const setDisplayMode = (setting: DisplayMode) => {
      const newSettings = setChannelSetting<HeapSetting>(
        settings,
        { displayMode: setting },
        chFlag
      );

      mutate({
        val: JSON.stringify(newSettings),
      });
    };

    const setSortMode = (setting: SortMode) => {
      const newSettings = setChannelSetting<HeapSetting>(
        settings,
        { sortMode: setting },
        chFlag
      );

      mutate({
        val: JSON.stringify(newSettings),
      });
    };

    useEffect(() => {
      if (draggedFile) {
        setAddCurioOpen(true);
      }
    });

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
      <ChannelHeader groupFlag={groupFlag} nest={nest}>
        {isMobile ? (
          <div className="flex h-12 items-center justify-end space-x-2 sm:h-auto">
            <ActionMenu
              actions={actions}
              open={isOpen}
              onOpenChange={setIsOpen}
            >
              <button>
                <FilterIconMobileNav className="mt-0.5 h-8 w-8 text-gray-900" />
              </button>
            </ActionMenu>
            <button
              onClick={() => setAddCurioOpen(true)}
              disabled={!compatible}
            >
              <AddIconMobileNav className="h-8 w-8 text-black" />
            </button>
          </div>
        ) : (
          <>
            {canWrite && (
              <Tooltip content={text} open={compatible ? false : undefined}>
                <button
                  className="button whitespace-nowrap"
                  onClick={() => setAddCurioOpen(true)}
                  disabled={!compatible || addCurioOpen}
                  hidden={!canWrite}
                  data-testid="add-block-button"
                >
                  New Block
                </button>
              </Tooltip>
            )}
            <DisplayDropdown
              displayMode={display}
              setDisplayMode={setDisplayMode}
            />
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <button className="flex h-6 w-6 items-center justify-center rounded  text-gray-600 hover:bg-gray-50 ">
                  <SortIcon className="h-6 w-6" />
                </button>
              </Dropdown.Trigger>
              <Dropdown.Content className="dropdown">
                <Dropdown.Item
                  className={cn(
                    'dropdown-item',
                    sort === 'time' && 'bg-gray-100 hover:bg-gray-100'
                  )}
                  onClick={() => (setSortMode ? setSortMode('time') : null)}
                >
                  Time
                </Dropdown.Item>
                <Dropdown.Item
                  className={cn(
                    'dropdown-item',
                    sort === 'alpha' && 'bg-gray-100 hover:bg-gray-100'
                  )}
                  onClick={() => (setSortMode ? setSortMode('alpha') : null)}
                >
                  Alphabetical
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          </>
        )}
        <AddCurioModal
          open={addCurioOpen}
          setOpen={setAddCurioOpen}
          flag={groupFlag}
          chFlag={chFlag}
          draggedFile={draggedFile}
          clearDragState={clearDragState}
          dragErrorMessage={dragErrorMessage}
        />
      </ChannelHeader>
    );
  }
);

export default HeapHeader;
