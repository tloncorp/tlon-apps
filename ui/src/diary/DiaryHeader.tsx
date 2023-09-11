import React, { useState } from 'react';
import cn from 'classnames';
import ChannelHeader from '@/channels/ChannelHeader';
import SortIcon from '@/components/icons/SortIcon';
import { useLeaveMutation } from '@/state/channel/channel';
import { useChannelOld as useChannelSpecific } from '@/logic/channel';
import {
  setChannelSetting,
  DiarySetting,
  useDiarySettings,
  usePutEntryMutation,
} from '@/state/settings';
import { DiaryDisplayMode } from '@/types/diary';
import { getFlagParts, nestToFlag } from '@/logic/utils';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/logic/useMedia';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import ActionMenu, { Action } from '@/components/ActionMenu';

interface DiaryHeaderProps {
  flag: string;
  nest: string;
  canWrite: boolean;
  sort: DiarySetting['sortMode'];
  display: DiaryDisplayMode;
}

const DiaryHeader = React.memo(
  ({ flag, nest, canWrite, sort, display }: DiaryHeaderProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [, chFlag] = nestToFlag(nest);
    const chan = useChannelSpecific(nest);
    const { ship } = getFlagParts(flag);
    const isMobile = useIsMobile();
    const saga = chan?.saga || null;
    const settings = useDiarySettings();
    const { mutateAsync: leaveDiary } = useLeaveMutation();
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
        content: 'Sort: Arranged',
        key: 'sort-arranged',
        onClick: () => (setSortMode ? setSortMode('arranged') : null),
        type: sort === 'arranged' ? 'prominent' : 'default',
      },
      {
        content: 'Sort: New Posts First',
        key: 'sort-time-dsc',
        onClick: () => (setSortMode ? setSortMode('time-dsc') : null),
        type: sort === 'time-dsc' ? 'prominent' : 'default',
      },
      {
        content: 'Sort: Old Posts First',
        key: 'sort-time-asc',
        onClick: () => (setSortMode ? setSortMode('time-asc') : null),
        type: sort === 'time-asc' ? 'prominent' : 'default',
      },
      {
        content: 'Sort: New Comments First',
        key: 'sort-quip-dsc',
        onClick: () => (setSortMode ? setSortMode('quip-dsc') : null),
        type: sort === 'quip-dsc' ? 'prominent' : 'default',
      },
    ];

    return (
      <ChannelHeader
        flag={flag}
        nest={nest}
        prettyAppName="Notebook"
        leave={() => leaveDiary({ nest })}
      >
        <div className="flex h-12 items-center justify-end space-x-2 sm:h-auto">
          <ActionMenu open={isOpen} onOpenChange={setIsOpen} actions={actions}>
            <button>
              {isMobile ? (
                <FilterIconMobileNav className="mt-0.5 h-8 w-8 text-gray-900" />
              ) : (
                <SortIcon className="h-6 w-6 text-gray-600" />
              )}
            </button>
          </ActionMenu>
          {(canWrite && ship === window.our) ||
          (canWrite && saga && 'synced' in saga) ? (
            <Link
              to="edit"
              className={cn(
                isMobile
                  ? ''
                  : 'small-button shrink-0 bg-blue px-1 text-white sm:px-2'
              )}
            >
              {isMobile ? (
                <AddIconMobileNav className="h-8 w-8 text-black" />
              ) : (
                <span className="hidden sm:inline">Add Note</span>
              )}
            </Link>
          ) : null}
        </div>
      </ChannelHeader>
    );
  }
);

export default DiaryHeader;
