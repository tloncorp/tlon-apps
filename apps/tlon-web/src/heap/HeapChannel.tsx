import * as Toast from '@radix-ui/react-toast';
import { Post, PostTuple } from '@tloncorp/shared/dist/urbit/channel';
import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import bigInt from 'big-integer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Outlet, useParams } from 'react-router';
import { GridStateSnapshot, VirtuosoGrid } from 'react-virtuoso';

import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import Layout from '@/components/Layout/Layout';
import X16Icon from '@/components/icons/X16Icon';
import { PASTEABLE_MEDIA_TYPES } from '@/constants';
import HeapBlock from '@/heap/HeapBlock';
import HeapRow from '@/heap/HeapRow';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useFullChannel } from '@/logic/channel';
import getKindDataFromEssay from '@/logic/getKindData';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { useIsMobile } from '@/logic/useMedia';
import { useInfinitePosts, useMarkReadMutation } from '@/state/channel/channel';
import { useRouteGroup } from '@/state/groups/groups';
import { useHeapDisplayMode, useHeapSortMode } from '@/state/settings';
import { useUploader } from '@/state/storage';

import HeapHeader from './HeapHeader';
import HeapPlaceholder from './HeapPlaceholder';

const virtuosoStateByFlag: Record<string, GridStateSnapshot> = {};

function HeapChannel({ title }: ViewProps) {
  const isMobile = useIsMobile();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const groupFlag = useRouteGroup();
  const {
    group,
    groupChannel: channel,
    canWrite,
    compat: { compatible },
  } = useFullChannel({ groupFlag, nest });

  const displayMode = useHeapDisplayMode(chFlag);
  const [addCurioOpen, setAddCurioOpen] = useState(false);
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const { posts, fetchNextPage, hasNextPage, isLoading } =
    useInfinitePosts(nest);
  const { mutateAsync: markRead, isLoading: isMarking } = useMarkReadMutation();

  const dropZoneId = useMemo(() => `new-curio-input-${chFlag}`, [chFlag]);
  const { isDragging, isOver, droppedFiles, setDroppedFiles } =
    useDragAndDrop(dropZoneId);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const uploadKey = useMemo(() => `new-curio-input-${chFlag}`, [chFlag]);
  const uploader = useUploader(uploadKey);
  const dragEnabled = !isMobile && compatible;
  const showDragTarget =
    dragEnabled && !isLoading && !addCurioOpen && isDragging && isOver;
  const [dragErrorMessage, setDragErrorMessage] = useState('');

  useDismissChannelNotifications({
    nest,
    markRead: useCallback(() => markRead({ nest }), [markRead, nest]),
    isMarking,
  });

  const renderCurio = useCallback(
    (i: number, outline: Post, time: bigInt.BigInteger) => (
      <div key={time.toString()} tabIndex={0} className="cursor-pointer">
        {displayMode === 'grid' ? (
          <div className="aspect-h-1 aspect-w-1">
            <HeapBlock post={outline} time={time.toString()} />
          </div>
        ) : (
          <HeapRow
            key={time.toString()}
            post={outline}
            time={time.toString()}
          />
        )}
      </div>
    ),
    [displayMode]
  );

  const empty = useMemo(() => posts.length === 0, [posts]);
  const sortedPosts = posts
    .filter(([k, v]) => v !== null)
    .sort(([a], [b]) => {
      if (sortMode === 'time') {
        return b.compare(a);
      }
      if (sortMode === 'alpha') {
        const postA = posts.find(([time]) => time.eq(a))![1];
        const postB = posts.find(([time]) => time.eq(b))![1];
        const { title: postATitle } = getKindDataFromEssay(postA?.essay);
        const { title: postBTitle } = getKindDataFromEssay(postB?.essay);

        return postATitle.localeCompare(postBTitle);
      }
      return b.compare(a);
    });

  const loadOlderCurios = useCallback(
    (atBottom: boolean) => {
      if (atBottom && hasNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, fetchNextPage]
  );

  const computeItemKey = (_i: number, [time, _curio]: PostTuple) =>
    time.toString();

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: isMobile ? 1200 : 2500,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const handleDrop = useCallback((fileList: FileList) => {
    const uploadFile = Array.from(fileList).find((file) =>
      PASTEABLE_MEDIA_TYPES.includes(file.type)
    );
    if (uploadFile) {
      setDraggedFile(uploadFile);
    } else {
      setDragErrorMessage('Only images can be uploaded');
    }
  }, []);

  const clearDragState = useCallback(() => {
    setDragErrorMessage('');
    setDraggedFile(null);
    setDroppedFiles((prev) => {
      if (prev) {
        const { [dropZoneId]: _files, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, [dropZoneId, setDroppedFiles, setDraggedFile]);

  useEffect(() => {
    if (dragEnabled && droppedFiles && droppedFiles[dropZoneId]) {
      if (uploader) {
        handleDrop(droppedFiles[dropZoneId]);
      } else {
        setDragErrorMessage('Remote storage must be enabled to upload files');
      }
    }
  }, [droppedFiles, handleDrop, dropZoneId, dragEnabled, uploader]);

  const DragDisplay = useCallback(
    () => (
      <div
        id={dropZoneId}
        className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-gray-50 p-10 opacity-95"
      >
        <div className="flex h-full w-full items-center justify-center rounded-lg border-[3px] border-dashed border-gray-200">
          <div className="text-lg font-bold">Drop Attachments Here</div>
        </div>
      </div>
    ),
    [dropZoneId]
  );

  return (
    <Layout
      className="flex-1 bg-white sm:pt-0"
      aside={<Outlet />}
      header={
        <HeapHeader
          groupFlag={groupFlag}
          nest={nest}
          display={displayMode}
          sort={sortMode}
          canWrite={canWrite}
          draggedFile={draggedFile}
          clearDragState={clearDragState}
          addCurioOpen={addCurioOpen}
          setAddCurioOpen={setAddCurioOpen}
          dragErrorMessage={dragErrorMessage}
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
      <div id={dropZoneId} className="h-full bg-gray-50 p-4">
        {empty && isLoading ? (
          <div className="h-full w-full">
            <HeapPlaceholder count={30} />
          </div>
        ) : empty && !compatible ? (
          <EmptyPlaceholder>
            <p>
              There may be content in this channel, but it is inaccessible
              because the host is using an older, incompatible version of the
              app.
            </p>
            <p>Please try again later.</p>
          </EmptyPlaceholder>
        ) : (
          <VirtuosoGrid
            data={sortedPosts}
            itemContent={(i, [time, curio]) => renderCurio(i, curio!, time)}
            computeItemKey={computeItemKey}
            style={{ height: '100%', width: '100%', paddingTop: '1rem' }}
            atBottomStateChange={loadOlderCurios}
            listClassName={
              displayMode === 'list'
                ? 'heap-list'
                : isMobile
                  ? 'heap-grid-mobile'
                  : 'heap-grid'
            }
            stateChanged={(state) => {
              virtuosoStateByFlag[chFlag] = state;
            }}
            restoreStateFrom={virtuosoStateByFlag[chFlag]}
            {...thresholds}
          />
        )}
        {showDragTarget && <DragDisplay />}
        <Toast.Provider>
          <Toast.Root
            duration={5000}
            defaultOpen={false}
            open={!addCurioOpen && dragErrorMessage !== ''}
            onOpenChange={() => setDragErrorMessage('')}
          >
            <Toast.Description asChild>
              <div
                className="absolute left-0 top-0 z-50 flex w-full cursor-pointer items-start justify-center border-green"
                onClick={() => setDragErrorMessage('')}
              >
                <div className="mt-2 rounded-lg bg-red-100 p-4 font-semibold text-red shadow-sm">
                  {dragErrorMessage}
                  <X16Icon className="ml-2 inline h-4 w-4" />
                </div>
              </div>
            </Toast.Description>
          </Toast.Root>
          <Toast.Viewport label="Post successfully published" />
        </Toast.Provider>
      </div>
    </Layout>
  );
}

export default HeapChannel;
