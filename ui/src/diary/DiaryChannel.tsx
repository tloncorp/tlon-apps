import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import bigInt from 'big-integer';
import { Virtuoso } from 'react-virtuoso';
import { unixToDa } from '@urbit/api';
import * as Toast from '@radix-ui/react-toast';
import { useQueryClient } from '@tanstack/react-query';
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
  useDiarySortMode,
  useDiaryPerms,
  useOlderNotes,
  useJoinDiaryMutation,
  useDiaryIsJoined,
  useMarkReadDiaryMutation,
  usePendingNotes,
  useDiaryState,
  useNotesOnHost,
  useArrangedNotes,
} from '@/state/diary';
import {
  useUserDiarySortMode,
  useUserDiaryDisplayMode,
} from '@/state/settings';
import { useConnectivityCheck } from '@/state/vitals';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { ViewProps } from '@/types/groups';
import DiaryGridView from '@/diary/DiaryList/DiaryGridView';
import useRecentChannel from '@/logic/useRecentChannel';
import { canReadChannel, canWriteChannel } from '@/logic/utils';
import { useLastReconnect } from '@/state/local';
import { DiaryOutline } from '@/types/diary';
import DiaryListItem from './DiaryList/DiaryListItem';
import useDiaryActions from './useDiaryActions';
import DiaryChannelListPlaceholder from './DiaryChannelListPlaceholder';
import DiaryHeader from './DiaryHeader';

function DiaryChannel({ title }: ViewProps) {
  const [joining, setJoining] = useState(false);
  const [shouldLoadOlderNotes, setShouldLoadOlderNotes] = useState(false);
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const { data } = useConnectivityCheck(chShip ?? '');
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
  const notesOnHost = useNotesOnHost(chFlag, pendingNotes.length > 0);

  const checkForNotes = useCallback(async () => {
    // if we have pending notes and the ship is connected
    // we can check if the notes have been posted
    // if they have, we can refetch the data to get the new note.
    // only called if onSuccess in useAddNoteMutation fails to clear pending notes
    if (
      data?.status &&
      'complete' in data.status &&
      data.status.complete === 'yes'
    ) {
      if (
        pendingNotes.length > 0 &&
        notesOnHost &&
        !Object.entries(notesOnHost).every(([_time, n]) =>
          Array.from(letters).find(([_t, l]) => l.sent === n.sent)
        )
      ) {
        queryClient.refetchQueries({
          queryKey: ['diary', 'notes', chFlag],
          exact: true,
        });
        useDiaryState.setState({
          pendingNotes: [],
        });
      }
    }
  }, [chFlag, queryClient, data, letters, notesOnHost, pendingNotes]);

  const clearPendingNotes = useCallback(() => {
    // if we have pending notes and the ship is connected
    // we can check if the notes have been posted
    // if they have, we can clear the pending notes
    // only called if onSuccess in useAddNoteMutation fails to clear pending notes
    if (
      pendingNotes.length > 0 &&
      data?.status &&
      'complete' in data.status &&
      data.status.complete === 'yes'
    ) {
      pendingNotes.forEach((id) => {
        if (
          notesOnHost &&
          Object.entries(notesOnHost).find(
            ([_t, l]) => unixToDa(l.sent).toString() === id
          )
        ) {
          useDiaryState.setState((s) => ({
            pendingNotes: s.pendingNotes.filter((n) => n !== id),
          }));
        }
      });
    }
  }, [pendingNotes, notesOnHost, data]);

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
    checkForNotes();
    clearPendingNotes();
  }, [checkForNotes, clearPendingNotes]);

  const newNote = new URLSearchParams(location.search).get('new');
  const [showToast, setShowToast] = useState(false);
  const { didCopy, onCopy } = useDiaryActions({
    flag: chFlag,
    time: newNote || '',
  });

  // user can override admin-set display and sort mode for this channel type
  const userDisplayMode = useUserDiaryDisplayMode(chFlag);
  const userSortMode = useUserDiarySortMode(chFlag);
  const displayMode = useDiaryDisplayMode(chFlag);
  const sortMode = useDiarySortMode(chFlag);
  const arrangedNotes = useArrangedNotes(chFlag);
  const lastArrangedNote = arrangedNotes[arrangedNotes.length - 1];

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
    if (sortMode === 'arranged') {
      console.log(a.toString(), b.toString());
      // if only one note is arranged, put it first
      if (
        arrangedNotes.includes(a.toString()) &&
        !arrangedNotes.includes(b.toString())
      ) {
        return -1;
      }

      // if both notes are arranged, sort by their position in the arranged list
      if (
        arrangedNotes.includes(a.toString()) &&
        arrangedNotes.includes(b.toString())
      ) {
        return arrangedNotes.indexOf(a.toString()) >
          arrangedNotes.indexOf(b.toString())
          ? 1
          : -1;
      }
    }

    if (userSortMode === 'time-dsc') {
      return b.compare(a);
    }
    if (userSortMode === 'time-asc') {
      return a.compare(b);
    }

    return b.compare(a);
  });

  const itemContent = (
    i: number,
    [time, outline]: [bigInt.BigInteger, DiaryOutline]
  ) => (
    <div className="my-6 mx-auto max-w-[600px] px-6">
      <DiaryListItem outline={outline} time={time} />
      {lastArrangedNote === time.toString() && (
        <div className="mt-6 flex justify-center">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-gray-500" />
          </div>
        </div>
      )}
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
      className="flex-1 bg-white sm:pt-0"
      aside={<Outlet />}
      header={
        <DiaryHeader
          flag={flag}
          nest={nest}
          canWrite={canWrite}
          display={userDisplayMode ?? displayMode}
          sort={userSortMode ?? sortMode === 'time' ? 'time-dsc' : 'arranged'}
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
      <div className="h-full bg-gray-50">
        {isLoading ? (
          <DiaryChannelListPlaceholder count={4} />
        ) : (displayMode === 'grid' && userDisplayMode === undefined) ||
          userDisplayMode === 'grid' ? (
          <DiaryGridView
            outlines={sortedNotes}
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
