import { useState } from 'react';
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
import DisplayDropdown from '@/channels/DisplayDropdown';
import { useLeaveHeapMutation } from '@/state/heap/heap';
import AddCurioModal from './AddCurioModal';

interface HeapHeaderProps {
  flag: string;
  nest: string;
  display: HeapDisplayMode;
  sort: HeapSortMode;
  canWrite: boolean;
}

export default function HeapHeader({
  flag,
  nest,
  display,
  sort,
  canWrite,
}: HeapHeaderProps) {
  const [addCurioOpen, setAddCurioOpen] = useState(false);
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

  return (
    <ChannelHeader
      flag={flag}
      nest={nest}
      prettyAppName="Gallery"
      leave={(leaveFlag: string) =>
        leaveHeapMutation.mutateAsync({ flag: leaveFlag })
      }
    >
      <button
        className="button"
        onClick={() => setAddCurioOpen(true)}
        disabled={addCurioOpen}
        hidden={!canWrite}
      >
        New Block
      </button>
      <DisplayDropdown displayMode={display} setDisplayMode={setDisplayMode} />
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
      <AddCurioModal
        open={addCurioOpen}
        setOpen={setAddCurioOpen}
        flag={flag}
        chFlag={chFlag}
      />
    </ChannelHeader>
  );
}
