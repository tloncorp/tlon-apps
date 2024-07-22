import * as Toast from '@radix-ui/react-toast';
import {
  ChannelsSubscribeResponse,
  PostTuple,
} from '@tloncorp/shared/dist/urbit/channel';
import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import React, { useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import api from '@/api';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import Layout from '@/components/Layout/Layout';
import DiaryGridView from '@/diary/DiaryList/DiaryGridView';
import { useFullChannel, useMarkChannelRead } from '@/logic/channel';
import {
  useArrangedPosts,
  useDisplayMode,
  useInfinitePosts,
  useSortMode,
} from '@/state/channel/channel';
import { useRouteGroup } from '@/state/groups/groups';
import {
  useUserDiaryDisplayMode,
  useUserDiarySortMode,
} from '@/state/settings';

import DiaryChannelListPlaceholder from './DiaryChannelListPlaceholder';
import DiaryHeader from './DiaryHeader';
import DiaryListItem from './DiaryList/DiaryListItem';

const virtuosoStateByFlag: Record<string, StateSnapshot> = {};

function DiaryChannel({ title }: ViewProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const groupFlag = useRouteGroup();
  const {
    posts: notes,
    isLoading,
    hasNextPage,
    fetchNextPage,
  } = useInfinitePosts(nest);
  const { markRead } = useMarkChannelRead(nest, undefined, true);
  const loadOlderNotes = useCallback(
    (atBottom: boolean) => {
      if (atBottom && hasNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, fetchNextPage]
  );

  const {
    group,
    groupChannel: channel,
    canWrite,
    compat: { compatible },
  } = useFullChannel({
    groupFlag,
    nest,
  });

  const awaitingNote = new URLSearchParams(location.search).get('awaiting');
  const newNote = new URLSearchParams(location.search).get('new');
  const awaitingMsg = 'Note saved, awaiting host confirmation';
  const newMsg = 'Note successfully published';

  // user can override admin-set display and sort mode for this channel type
  const userDisplayMode = useUserDiaryDisplayMode(chFlag);
  const userSortMode = useUserDiarySortMode(chFlag);
  const displayMode = useDisplayMode(nest);
  const sortMode = useSortMode(nest);
  const arrangedNotes = useArrangedPosts(nest);
  const lastArrangedNote = arrangedNotes[arrangedNotes.length - 1];

  useEffect(() => {
    let timeout: any;

    if (awaitingNote) {
      timeout = setTimeout(() => {
        navigate(location.pathname, { replace: true });
      }, 3000);

      api
        .track<ChannelsSubscribeResponse>(
          { app: 'channels', path: `/v1/${nest}` },
          ({ response }) => {
            if ('post' in response) {
              const { 'r-post': postResponse } = response.post;
              return (
                'set' in postResponse &&
                postResponse.set !== null &&
                postResponse.set.essay.author === window.our &&
                postResponse.set.essay.sent === parseInt(awaitingNote, 10)
              );
            }

            return false;
          }
        )
        .then(() => {
          navigate(`${location.pathname}?new=${awaitingNote}`, {
            replace: true,
          });
        });
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [nest, awaitingNote, location, navigate]);

  useEffect(() => {
    let timeout: any;

    if (newNote) {
      timeout = setTimeout(() => {
        navigate(location.pathname, { replace: true });
      }, 3000);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [newNote, location, navigate]);

  useEffect(() => {
    markRead();
  }, [nest]);

  const sortedNotes = notes
    .filter(([k, v]) => v !== null)
    .sort(([a], [b]) => {
      if (sortMode === 'arranged') {
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

  const itemContent = (i: number, [time, outline]: PostTuple) => (
    <div className="mx-auto my-6 max-w-[600px] px-6">
      <DiaryListItem note={outline!} time={time} />
      {lastArrangedNote === time.toString() && (
        <div className="mt-6 flex justify-center">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-gray-500" />
          </div>
        </div>
      )}
    </div>
  );

  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    const currentVirtuosoRef = virtuosoRef.current;
    return () => {
      currentVirtuosoRef?.getState((state) => {
        virtuosoStateByFlag[chFlag] = state;
      });
    };
  }, [chFlag]);

  return (
    <Layout
      stickyHeader
      className="flex-1 bg-white sm:pt-0"
      aside={<Outlet />}
      header={
        <DiaryHeader
          groupFlag={groupFlag}
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
          <Toast.Root
            duration={3000}
            defaultOpen={false}
            open={!!(awaitingNote || newNote)}
          >
            <Toast.Description asChild>
              <div className="absolute z-10 flex -translate-x-2/4 items-center justify-between space-x-2 rounded-lg bg-white font-semibold text-black shadow-xl dark:bg-gray-200">
                {awaitingNote ? (
                  <span className="px-4 py-2">{awaitingMsg}</span>
                ) : (
                  <span className="px-4 py-2">{newMsg}</span>
                )}
              </div>
            </Toast.Description>
          </Toast.Root>
          <Toast.Viewport label={awaitingNote ? awaitingMsg : newMsg} />
        </div>
      </Toast.Provider>
      <div className="h-full bg-gray-50">
        {isLoading ? (
          <DiaryChannelListPlaceholder count={4} />
        ) : !compatible && sortedNotes.length === 0 ? (
          <EmptyPlaceholder>
            <p>
              There may be content in this channel, but it is inaccessible
              because the host is using an older, incompatible version of the
              app.
            </p>
            <p>Please try again later.</p>
          </EmptyPlaceholder>
        ) : (displayMode === 'grid' && userDisplayMode === undefined) ||
          userDisplayMode === 'grid' ? (
          <DiaryGridView
            outlines={sortedNotes}
            loadOlderNotes={loadOlderNotes}
          />
        ) : (
          <div className="h-full">
            <div className="mx-auto flex h-full w-full flex-col">
              <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%', width: '100%' }}
                data={sortedNotes}
                itemContent={itemContent}
                overscan={200}
                atBottomStateChange={loadOlderNotes}
                components={{
                  Header: () => <div />,
                  Footer: () => <div className="h-4 w-full" />,
                }}
                restoreStateFrom={virtuosoStateByFlag[chFlag]}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default DiaryChannel;
