import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { Outlet, useParams, useNavigate } from 'react-router';
import { Helmet } from 'react-helmet';
import bigInt from 'big-integer';
import { ViewProps } from '@/types/groups';
import Layout from '@/components/Layout/Layout';
import {
  useRouteGroup,
  useChannel,
  useGroup,
  useVessel,
} from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapState,
  useHeapPerms,
} from '@/state/heap/heap';
import { VirtuosoGrid } from 'react-virtuoso';
import ChannelHeader from '@/channels/ChannelHeader';
import {
  HeapSetting,
  setChannelSetting,
  useHeapSettings,
  useHeapSortMode,
  useHeapDisplayMode,
  useSettingsState,
} from '@/state/settings';
import HeapBlock from '@/heap/HeapBlock';
import HeapRow from '@/heap/HeapRow';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import {
  canReadChannel,
  canWriteChannel,
  isChannelJoined,
} from '@/logic/utils';
import { GRID, HeapCurio, HeapDisplayMode, HeapSortMode } from '@/types/heap';
import useRecentChannel from '@/logic/useRecentChannel';
import useAllBriefs from '@/logic/useAllBriefs';
import makeCuriosStore from '@/state/heap/curios';
import { useIsMobile } from '@/logic/useMedia';
import NewCurioForm from './NewCurioForm';

function HeapChannel({ title }: ViewProps) {
  const [joining, setJoining] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();
  const vessel = useVessel(flag, window.our);
  const channel = useChannel(flag, nest);
  const group = useGroup(flag);
  const { setRecentChannel } = useRecentChannel(flag);
  const displayMode = useHeapDisplayMode(chFlag);
  const settings = useHeapSettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const curios = useCuriosForHeap(chFlag);
  const perms = useHeapPerms(chFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const briefs = useAllBriefs();
  const joined = Object.keys(briefs).some((k) => k.includes('heap/'))
    ? isChannelJoined(nest, briefs)
    : true;

  const joinChannel = useCallback(async () => {
    setJoining(true);
    await useHeapState.getState().joinHeap(flag, chFlag);
    setJoining(false);
  }, [flag, chFlag]);

  const initializeChannel = useCallback(async () => {
    await useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  const setDisplayMode = (setting: HeapDisplayMode) => {
    const newSettings = setChannelSetting<HeapSetting>(
      settings,
      { displayMode: setting },
      chFlag
    );
    useSettingsState
      .getState()
      .putEntry('heaps', 'heapSettings', JSON.stringify(newSettings));
  };

  const setSortMode = (setting: HeapSortMode) => {
    const newSettings = setChannelSetting<HeapSetting>(
      settings,
      { sortMode: setting },
      chFlag
    );
    useSettingsState
      .getState()
      .putEntry('heaps', 'heapSettings', JSON.stringify(newSettings));
  };

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
      initializeChannel();
      setRecentChannel(nest);
    }
  }, [
    chFlag,
    nest,
    setRecentChannel,
    joined,
    joining,
    initializeChannel,
    channel,
    canRead,
  ]);

  useEffect(() => {
    if (channel && !canRead) {
      navigate(`/groups/${flag}`);
      setRecentChannel('');
    }
  }, [flag, group, channel, vessel, navigate, setRecentChannel, canRead]);
  useDismissChannelNotifications({
    nest,
    markRead: useHeapState.getState().markRead,
  });

  const renderCurio = useCallback(
    (i: number, curio: HeapCurio, time: bigInt.BigInteger) =>
      i === 0 && canWrite ? (
        <NewCurioForm />
      ) : (
        <div
          key={time.toString()}
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => navigateToDetail(time)}
        >
          {displayMode === GRID ? (
            <div className="aspect-h-1 aspect-w-1">
              <HeapBlock curio={curio} time={time.toString()} />
            </div>
          ) : (
            <HeapRow
              key={time.toString()}
              curio={curio}
              time={time.toString()}
            />
          )}
        </div>
      ),
    [displayMode, navigateToDetail, canWrite]
  );

  const getCurioTitle = (curio: HeapCurio) =>
    curio.heart.title ||
    curio.heart.content.toString().split(' ').slice(0, 3).join(' ');

  const emptyCurio: HeapCurio = {
    heart: {
      title: 'Loading...',
      content: {
        inline: [],
        block: [],
      },
      author: '',
      sent: 0,
      replying: null,
    },
    seal: {
      time: bigInt(0).toString(),
      feels: {
        '': '',
      },
      replied: [''],
    },
  };

  const fakeCurioMap: [bigInt.BigInteger, HeapCurio][] = [
    [bigInt(1), emptyCurio],
  ];

  const sortedCurios = fakeCurioMap.concat(
    Array.from(curios)
      .sort(([a], [b]) => {
        if (sortMode === 'time') {
          return b.compare(a);
        }
        if (sortMode === 'alpha') {
          const curioA = curios.get(a);
          const curioB = curios.get(b);

          return getCurioTitle(curioA).localeCompare(getCurioTitle(curioB));
        }
        return b.compare(a);
      })
      .filter(([, c]) => !c.heart.replying)
  );

  const loadOlderCurios = useCallback(
    (atBottom: boolean) => {
      if (atBottom) {
        makeCuriosStore(
          chFlag,
          () => useHeapState.getState(),
          `/heap/${chFlag}/curios`,
          `/heap/${chFlag}/ui`
        ).getOlder('50');
      }
    },
    [chFlag]
  );

  const computeItemKey = (
    _i: number,
    [time, _curio]: [bigInt.BigInteger, HeapCurio]
  ) => time.toString();

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: isMobile ? 1200 : 2500,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  return (
    <Layout
      className="flex-1 bg-gray-50"
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
      <div className="h-full p-4">
        <VirtuosoGrid
          data={canWrite ? sortedCurios : sortedCurios.slice(1)}
          itemContent={(i, [time, curio]) => renderCurio(i, curio, time)}
          computeItemKey={computeItemKey}
          style={{ height: '100%', width: '100%', paddingTop: '1rem' }}
          atBottomStateChange={loadOlderCurios}
          listClassName={cn(
            `heap-${displayMode}`,
            displayMode === 'grid' && 'grid-cols-minmax'
          )}
          {...thresholds}
        />
      </div>
    </Layout>
  );
}

export default HeapChannel;
