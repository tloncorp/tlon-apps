import { useCallback, useEffect, useState, useMemo } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router';
import * as Toast from '@radix-ui/react-toast';
import { Helmet } from 'react-helmet';
import bigInt from 'big-integer';
import { VirtuosoGrid } from 'react-virtuoso';
import { ViewProps } from '@/types/groups';
import Layout from '@/components/Layout/Layout';
import {
  useRouteGroup,
  useGroupChannel,
  useGroup,
  useVessel,
} from '@/state/groups/groups';
import {
  usePerms,
  useMarkReadMutation,
  useJoinMutation,
  useInfiniteOutlines,
} from '@/state/channel/channel';
import { useHeapSortMode, useHeapDisplayMode } from '@/state/settings';
import HeapBlock from '@/heap/HeapBlock';
import HeapRow from '@/heap/HeapRow';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { canReadChannel, canWriteChannel } from '@/logic/utils';
import useRecentChannel from '@/logic/useRecentChannel';
import { useIsMobile } from '@/logic/useMedia';
import { useLastReconnect } from '@/state/local';
import { useChannelCompatibility, useChannelIsJoined } from '@/logic/channel';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { PASTEABLE_IMAGE_TYPES } from '@/constants';
import { useUploader } from '@/state/storage';
import X16Icon from '@/components/icons/X16Icon';
import { Outline } from '@/types/channel';
import HeapHeader from './HeapHeader';
import HeapPlaceholder from './HeapPlaceholder';

function HeapChannel({ title }: ViewProps) {
  const [joining, setJoining] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();
  const vessel = useVessel(flag, window.our);
  const channel = useGroupChannel(flag, nest);
  const group = useGroup(flag);
  const { setRecentChannel } = useRecentChannel(flag);
  const displayMode = useHeapDisplayMode(chFlag);
  const [addCurioOpen, setAddCurioOpen] = useState(false);
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const { outlines, fetchNextPage, hasNextPage, isLoading } =
    useInfiniteOutlines(nest);
  const { mutateAsync: markRead } = useMarkReadMutation();
  const { mutateAsync: joinHeap } = useJoinMutation();
  const perms = usePerms(nest);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const joined = useChannelIsJoined(nest);
  const lastReconnect = useLastReconnect();
  const { compatible } = useChannelCompatibility(nest);

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

  const joinChannel = useCallback(async () => {
    setJoining(true);
    await joinHeap({ group: flag, chan: nest });
    setJoining(false);
  }, [flag, nest, joinHeap]);

  const navigateToDetail = useCallback(
    (time: bigInt.BigInteger) => {
      navigate(`curio/${time}`);
    },
    [navigate]
  );

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
    if (channel && !canRead) {
      navigate(`/groups/${flag}`);
      setRecentChannel('');
    }
  }, [flag, group, channel, vessel, navigate, setRecentChannel, canRead]);
  useDismissChannelNotifications({
    nest,
    markRead: useCallback(() => markRead({ nest }), [markRead, nest]),
  });

  const renderCurio = useCallback(
    (i: number, outline: Outline, time: bigInt.BigInteger) => (
      <div key={time.toString()} tabIndex={0} className="cursor-pointer">
        {displayMode === 'grid' ? (
          <div className="aspect-h-1 aspect-w-1">
            <HeapBlock outline={outline} time={time.toString()} />
          </div>
        ) : (
          <div onClick={() => navigateToDetail(time)}>
            <HeapRow
              key={time.toString()}
              outline={outline}
              time={time.toString()}
            />
          </div>
        )}
      </div>
    ),
    [displayMode, navigateToDetail]
  );

  const getOutlineTitle = (outline: Outline) =>
    'heap' in outline['han-data']
      ? outline['han-data'].heap ||
        outline.content.toString().split(' ').slice(0, 3).join(' ')
      : '';

  const empty = useMemo(() => Array.from(outlines).length === 0, [outlines]);
  const sortedOutlines = Array.from(outlines).sort(([a], [b]) => {
    if (sortMode === 'time') {
      return b.compare(a);
    }
    if (sortMode === 'alpha') {
      const outlineA = outlines.get(a);
      const outlineB = outlines.get(b);

      return getOutlineTitle(outlineA).localeCompare(getOutlineTitle(outlineB));
    }
    return b.compare(a);
  });

  const loadOlderCurios = useCallback(
    (atBottom: boolean) => {
      if (atBottom && hasNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage]
  );

  const computeItemKey = (
    _i: number,
    [time, _curio]: [bigInt.BigInteger, Outline]
  ) => time.toString();

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: isMobile ? 1200 : 2500,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const handleDrop = useCallback((fileList: FileList) => {
    const uploadFile = Array.from(fileList).find((file) =>
      PASTEABLE_IMAGE_TYPES.includes(file.type)
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
        className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-gray-50 p-10 opacity-95"
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
          flag={flag}
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
        ) : (
          <VirtuosoGrid
            data={sortedOutlines}
            itemContent={(i, [time, curio]) => renderCurio(i, curio, time)}
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
                className="absolute top-0 left-0 z-50 flex w-full cursor-pointer items-start justify-center border-green"
                onClick={() => setDragErrorMessage('')}
              >
                <div className="mt-2 rounded-lg bg-red-100 p-4 font-semibold text-red shadow-sm">
                  {dragErrorMessage}
                  <X16Icon className="ml-2 inline h-4 w-4" />
                </div>
              </div>
            </Toast.Description>
          </Toast.Root>
          <Toast.Viewport label="Note successfully published" />
        </Toast.Provider>
      </div>
    </Layout>
  );
}

export default HeapChannel;
