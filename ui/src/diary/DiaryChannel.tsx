import _ from 'lodash';
import React, { useCallback, useEffect } from 'react';
import { Outlet, useParams, useRoutes } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup, useVessel } from '@/state/groups/groups';
import { useNotesForDiary, useDiaryPerms, useDiaryState } from '@/state/diary';
import {
  DiarySetting,
  setSetting,
  useDiaryDisplayMode,
  useDiarySettings,
  useDiarySortMode,
  useSettingsState,
} from '@/state/settings';
import ChannelHeader from '@/channels/ChannelHeader';
import { useForm } from 'react-hook-form';
import { parseTipTapJSON } from '@/logic/tiptap';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { DiaryDisplayMode } from '@/types/diary';
import { Link } from 'react-router-dom';

interface NoteForm {
  title: string;
  image: string;
}

function DiaryChannel() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();

  const notes = useNotesForDiary(chFlag);
  const perms = useDiaryPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { register, handleSubmit, reset } = useForm<NoteForm>({
    defaultValues: {
      title: '',
      image: '',
    },
  });

  const settings = useDiarySettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const displayMode = useDiaryDisplayMode(chFlag);
  const sortMode = useDiarySortMode(chFlag);

  const setDisplayMode = (setting: DiaryDisplayMode) => {
    const newSettings = setSetting<DiarySetting>(
      settings,
      { displayMode: setting },
      chFlag
    );
    useSettingsState
      .getState()
      .putEntry('diary', 'settings', JSON.stringify(newSettings));
  };

  const setSortMode = (setting: 'time' | 'alpha') => {
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

  return (
    <Layout
      className="flex-1 bg-white"
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
        <ul>
          {Array.from(notes)
            .sort(([a], [b]) => b.compare(a))
            .map(([time, note]) => (
              <Link to={`note/${time.toString()}`}>
                <li key={time.toString()}>
                  <span>{note.essay.title}</span>
                </li>
              </Link>
            ))}
        </ul>
      </div>
    </Layout>
  );
}

export default DiaryChannel;
