import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
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
import { Link } from 'react-router-dom';
import * as Toast from '@radix-ui/react-toast';
import { useCopyToClipboard } from 'usehooks-ts';

function DiaryChannel() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const notes = useNotesForDiary(chFlag);
  const location = useLocation();
  const navigate = useNavigate();
  const newNote = new URLSearchParams(location.search).get('new');
  const [showToast, setShowToast] = useState(false);
  const [_copied, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);
  console.log(newNote);

  const settings = useDiarySettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const displayMode = useDiaryDisplayMode(chFlag);
  const sortMode = useDiarySortMode(chFlag);

  const setDisplayMode = (view: DiaryDisplayMode) => {
    useDiaryState.getState().viewDiary(chFlag, view);
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

  const onCopy = useCallback(() => {
    doCopy(`${flag}/channels/diary/${chFlag}/note/${newNote}`);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1000);
  }, [doCopy, chFlag, flag, newNote]);

  useEffect(() => {
    useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

  useEffect(() => {
    if (newNote) {
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate(location.pathname, { replace: true });
      }, 3000);
    }
  }, [newNote, location, navigate]);

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
      <Toast.Provider>
        <div className="relative flex flex-col items-center p-4">
          <Toast.Root duration={3000} defaultOpen={false} open={showToast}>
            <Toast.Description asChild>
              <div className="absolute z-10 flex w-[415px] -translate-x-2/4 items-center justify-between space-x-2 rounded-lg bg-white font-semibold drop-shadow-lg">
                <span className="py-2 px-4">Note successfully published</span>
                <button
                  onClick={onCopy}
                  className="-mx-4 -my-2 w-[135px] rounded-r-lg bg-blue py-2 px-4 text-white"
                >
                  {justCopied ? 'Copied' : 'Copy Note Link'}
                </button>
              </div>
            </Toast.Description>
          </Toast.Root>
          <Toast.Viewport label="Note successfully published" />
          <ul>
            {Array.from(notes)
              .sort(([a], [b]) => b.compare(a))
              .map(([time, note]) => (
                <li key={time.toString()}>
                  <Link to={`note/${time.toString()}`}>
                    <span>{note.essay.title}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </Toast.Provider>
    </Layout>
  );
}

export default DiaryChannel;
