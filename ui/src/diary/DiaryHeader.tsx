import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import ChannelHeader from '@/channels/ChannelHeader';
import SortIcon from '@/components/icons/SortIcon';
import DisplayDropdown from '@/channels/DisplayDropdown';
import { useDiary, useLeaveDiaryMutation } from '@/state/diary';
import {
  setChannelSetting,
  DiarySetting,
  useDiarySettings,
  usePutEntryMutation,
} from '@/state/settings';
import { DiaryDisplayMode } from '@/types/diary';
import { nestToFlag } from '@/logic/utils';
import { Link } from 'react-router-dom';
import AddIcon16 from '@/components/icons/Add16Icon';

interface DiaryHeaderProps {
  flag: string;
  nest: string;
  canWrite: boolean;
  sort: DiarySetting['sortMode'];
  display: DiaryDisplayMode;
}

export default function DiaryHeader({
  flag,
  nest,
  canWrite,
  sort,
  display,
}: DiaryHeaderProps) {
  const [, chFlag] = nestToFlag(nest);
  const settings = useDiarySettings();
  const { mutateAsync: leaveDiary } = useLeaveDiaryMutation();
  const { mutate } = usePutEntryMutation({
    bucket: 'diary',
    key: 'settings',
  });

  const setDisplayMode = async (view: DiaryDisplayMode) => {
    const newSettings = setChannelSetting<DiarySetting>(
      settings,
      { displayMode: view },
      chFlag
    );
    mutate({
      val: JSON.stringify(newSettings),
    });
  };

  const setSortMode = (
    setting: 'arranged' | 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc'
  ) => {
    const newSettings = setChannelSetting<DiarySetting>(
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
      prettyAppName="Notebook"
      leave={(ch) => leaveDiary({ flag: ch })}
    >
      {canWrite ? (
        <Link
          to="edit"
          className={'small-button shrink-0 bg-blue px-1 text-white sm:px-2'}
        >
          <AddIcon16 className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Add Note</span>
        </Link>
      ) : null}
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
              sort === 'arranged' && 'bg-gray-100 hover:bg-gray-100'
            )}
            onClick={() => (setSortMode ? setSortMode('arranged') : null)}
          >
            Arranged
          </Dropdown.Item>
          <Dropdown.Item
            className={cn(
              'dropdown-item',
              sort === 'time-dsc' && 'bg-gray-100 hover:bg-gray-100'
            )}
            onClick={() => (setSortMode ? setSortMode('time-dsc') : null)}
          >
            New Posts First
          </Dropdown.Item>
          <Dropdown.Item
            className={cn(
              'dropdown-item',
              sort === 'time-asc' && 'bg-gray-100 hover:bg-gray-100'
            )}
            onClick={() => (setSortMode ? setSortMode('time-asc') : null)}
          >
            Old Posts First
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Root>
    </ChannelHeader>
  );
}
