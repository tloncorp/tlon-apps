import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import bigInt from 'big-integer';
import { Virtuoso } from 'react-virtuoso';
import * as Toast from '@radix-ui/react-toast';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/api';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import Layout from '@/components/Layout/Layout';
import {
  useChannel,
  useGroup,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';
import {
  useNotes,
  useDiaryDisplayMode,
  useDiaryPerms,
  useOlderNotes,
  useJoinDiaryMutation,
  useDiaryIsJoined,
  useMarkReadDiaryMutation,
  usePendingNotes,
  useDiaryState,
} from '@/state/diary';
import { useDiarySortMode } from '@/state/settings';
import { useConnectivityCheck } from '@/state/vitals';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { DiaryLetter } from '@/types/diary';
import { ViewProps } from '@/types/groups';
import DiaryGridView from '@/diary/DiaryList/DiaryGridView';
import useRecentChannel from '@/logic/useRecentChannel';
import { canReadChannel, canWriteChannel } from '@/logic/utils';
import { useLastReconnect } from '@/state/local';
import DiaryListItem from './DiaryList/DiaryListItem';
import useDiaryActions from './useDiaryActions';
import DiaryChannelListPlaceholder from './DiaryChannelListPlaceholder';
import DiaryHeader from './DiaryHeader';

function DiaryChannel({ title }: ViewProps) {
  const [joining, setJoining] = useState(false);
  const [shouldLoadOlderNotes, setShouldLoadOlderNotes] = useState(false);
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const {
    data: { status: shipStatus },
  } = useConnectivityCheck(chShip ?? '');
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const vessel = useVessel(flag, window.our);
  const { letters, isLoading } = useNotes(chFlag);
  const pendingNotes = usePendingNotes();
  const queryClient = useQueryClient();
  const loadingOlderNotes = useOlderNotes(chFlag, 30, shouldLoadOlderNotes);
  const { mutateAsync: joinDiary } = useJoinDiaryMutation();
  const { mutateAsync: markRead } = useMarkReadDiaryMutation();
  const location = useLocation();
  const navigate = useNavigate();
  const { setRecentChannel } = useRecentChannel(flag);
  const group = useGroup(flag);
  const channel = useChannel(flag, nest);
  const joined = useDiaryIsJoined(chFlag);
  const lastReconnect = useLastReconnect();

  const joinChannel = useCallback(async () => {
    setJoining(true);
    await joinDiary({ group: flag, chan: chFlag });
    setJoining(false);
  }, [flag, chFlag, joinDiary]);

  useEffect(() => {
    if (channel && !canReadChannel(channel, vessel, group?.bloc)) {
      navigate(`/groups/${flag}`);
      setRecentChannel('');
    }
  }, [flag, group, channel, vessel, navigate, setRecentChannel]);

  useEffect(() => {
    // if we have pending notes and the ship is connected
    // we can check if the notes have been posted
    // if they have, we can refetch the data to get the new note
    // and clear the pending notes
    const notesOnHost = async () =>
      api.scry({
        app: 'diary',
        path: `/diary/${chFlag}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
      });

    if (
      pendingNotes.length > 0 &&
      'complete' in shipStatus &&
      shipStatus.complete === 'yes'
    ) {
      notesOnHost().then((notes) => {
        if (Array.isArray(notes) && notes.length === letters.size) {
          queryClient.refetchQueries({
            queryKey: ['diary', 'notes', chFlag],
            exact: true,
          });

          useDiaryState.getState().set((s) => ({
            ...s,
            pendingNotes: [],
          }));
        }
      });
    }
  }, [pendingNotes, chFlag, queryClient, shipStatus, letters.size]);

  const newNote = new URLSearchParams(location.search).get('new');
  const [showToast, setShowToast] = useState(false);
  const { didCopy, onCopy } = useDiaryActions({
    flag: chFlag,
    time: newNote || '',
  });

  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const displayMode = useDiaryDisplayMode(chFlag);
  const sortMode = useDiarySortMode(chFlag);

  const perms = useDiaryPerms(chFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel, channel]);

  useEffect(() => {
    if (joined && !joining && channel && canRead) {
      setRecentChannel(nest);
    }
  }, [
    chFlag,
    nest,
    setRecentChannel,
    joined,
    joining,
    channel,
    canRead,
    lastReconnect,
  ]);

  useEffect(() => {
    let timeout: any;

    if (newNote) {
      setShowToast(true);
      timeout = setTimeout(() => {
        setShowToast(false);
        navigate(location.pathname, { replace: true });
      }, 3000);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [newNote, location, navigate]);

  useDismissChannelNotifications({
    nest,
    markRead: useCallback(() => markRead({ flag: chFlag }), [markRead, chFlag]),
  });

  const sortedNotes = Array.from(letters).sort(([a], [b]) => {
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

  const itemContent = (
    i: number,
    [time, letter]: [bigInt.BigInteger, DiaryLetter]
  ) => (
    <div className="my-6 mx-auto max-w-[600px] px-6">
      <DiaryListItem letter={letter} time={time} />
    </div>
  );

  const loadOlderNotes = useCallback(
    (load: boolean) => {
      if (!loadingOlderNotes && load) {
        setShouldLoadOlderNotes(true);
      }
      setShouldLoadOlderNotes(false);
    },
    [loadingOlderNotes]
  );

  return (
    <Layout
      stickyHeader
      className="flex-1 bg-gray-50"
      aside={<Outlet />}
      header={
        <DiaryHeader
          flag={flag}
          nest={nest}
          canWrite={canWrite}
          display={displayMode}
          sort={sortMode}
        />
      }
    >
      <Helmet>
        <title>
          {channel && group
            ? `${channel.meta.title} in ${group.meta.title} ${title}`
            : title}
        </title>
      </Helmet>
      <Toast.Provider>
        <div className="relative flex flex-col items-center">
          <Toast.Root duration={3000} defaultOpen={false} open={showToast}>
            <Toast.Description asChild>
              <div className="absolute z-10 flex w-[415px] -translate-x-2/4 items-center justify-between space-x-2 rounded-lg bg-white font-semibold text-black shadow-xl dark:bg-gray-200">
                <span className="py-2 px-4">Note successfully published</span>
                <button
                  onClick={onCopy}
                  className="-mx-4 -my-2 w-[135px] rounded-r-lg bg-blue py-2 px-4 text-white dark:text-black"
                >
                  {didCopy ? 'Copied' : 'Copy Note Link'}
                </button>
              </div>
            </Toast.Description>
          </Toast.Root>
          <Toast.Viewport label="Note successfully published" />
        </div>
      </Toast.Provider>
      <div className="h-full">
        {isLoading ? (
          <DiaryChannelListPlaceholder count={4} />
        ) : displayMode === 'grid' ? (
          <DiaryGridView
            notes={sortedNotes}
            loadOlderNotes={() => {
              if (!loadingOlderNotes) {
                setShouldLoadOlderNotes(true);
              }
              setShouldLoadOlderNotes(false);
            }}
          />
        ) : (
          <div className="h-full">
            <div className="mx-auto flex h-full w-full flex-col">
              <Virtuoso
                style={{ height: '100%', width: '100%' }}
                data={sortedNotes}
                itemContent={itemContent}
                overscan={200}
                atBottomStateChange={(atBottom) => {
                  loadOlderNotes(atBottom);
                }}
                components={{
                  Header: () => <div />,
                  Footer: () => <div className="h-4 w-full" />,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default DiaryChannel;
