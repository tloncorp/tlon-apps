import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups/groups';
import {
  useNotesForDiary,
  useDiaryState,
  useDiaryDisplayMode,
} from '@/state/diary';
import {
  DiarySetting,
  setSetting,
  useDiarySettings,
  useDiarySortMode,
  useSettingsState,
} from '@/state/settings';
import ChannelHeader from '@/channels/ChannelHeader';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { DiaryDisplayMode } from '@/types/diary';
import DiaryGridView from '@/diary/DiaryList/DiaryGridView';
import { Link } from 'react-router-dom';
import DiaryListItem from './DiaryList/DiaryListItem';

function DiaryChannel() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const notes = useNotesForDiary(chFlag);

  const settings = useDiarySettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const displayMode = useDiaryDisplayMode(chFlag);
  const sortMode = useDiarySortMode(chFlag);

  const setDisplayMode = (view: DiaryDisplayMode) => {
    useDiaryState.getState().viewDiary(chFlag, view);
  };

  const setSortMode = (
    setting: 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc'
  ) => {
    const newSettings = setSetting<DiarySetting>(
      settings,
      { sortMode: setting },
      chFlag
    );
    useSettingsState
      .getState()
      .putEntry('diary', 'settings', JSON.stringify(newSettings));
  };

  useEffect(() => {
    useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

  useDismissChannelNotifications({
    markRead: useDiaryState.getState().markRead,
  });

  const sortedNotes = Array.from(notes).sort(([a], [b]) => {
    if (sortMode === 'time-dsc') {
      return b.compare(a);
    }
    if (sortMode === 'time-asc') {
      return a.compare(b);
    }
    // TODO: get the time of most recent quip from each diary note, and compare that way
    if (sortMode === 'quip-asc') {
      return b.compare(a);
    }
    if (sortMode === 'quip-dsc') {
      return b.compare(a);
    }
    return b.compare(a);
  });

  return (
    <Layout
      className="flex-1 overflow-y-scroll bg-gray-50"
      aside={<Outlet />}
      header={
        <ChannelHeader
          flag={flag}
          nest={nest}
          showControls
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          sortMode={sortMode}
          setSortMode={setSortMode}
        >
          <Link to="edit" className="button bg-blue text-white dark:text-black">
            Add Note
          </Link>
        </ChannelHeader>
      }
    >
      <div className="p-4">
        {displayMode === 'grid' ? (
          <DiaryGridView notes={sortedNotes} />
        ) : (
          <div className="h-full p-6">
            <div className="mx-auto flex h-full max-w-[600px] flex-col space-y-4">
              {sortedNotes.map(([time, note]) => (
                <DiaryListItem time={time} note={note} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default DiaryChannel;
