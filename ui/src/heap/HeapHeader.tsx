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
import { useHeapState } from '@/state/heap/heap';

interface HeapHeaderProps {
  flag: string;
  nest: string;
  display: HeapDisplayMode;
  sort: HeapSortMode;
}

export default function HeapHeader({
  flag,
  nest,
  display,
  sort,
}: HeapHeaderProps) {
  const [, chFlag] = nestToFlag(nest);
  const settings = useHeapSettings();
  const { mutate } = usePutEntryMutation({
    bucket: 'heaps',
    key: 'heapSettings',
  });

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
      leave={useHeapState.getState().leaveHeap}
    >
      <DisplayDropdown displayMode={display} setDisplayMode={setDisplayMode} />
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button className="flex h-6 w-6 items-center justify-center rounded  text-gray-400 hover:bg-gray-50 ">
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
            <span className="font-semibold">Time</span>
          </Dropdown.Item>
          <Dropdown.Item
            className={cn(
              'dropdown-item',
              sort === 'alpha' && 'bg-gray-100 hover:bg-gray-100'
            )}
            onClick={() => (setSortMode ? setSortMode('alpha') : null)}
          >
            <span className="font-semibold">Alphabetical</span>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Root>
    </ChannelHeader>
  );
}
