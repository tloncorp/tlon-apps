import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { Outlet, useParams, useNavigate } from 'react-router';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup, useChannel, useGroup } from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapDisplayMode,
  useHeapState,
} from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';
import {
  HeapSetting,
  setSetting,
  useHeapSettings,
  useHeapSortMode,
  useSettingsState,
} from '@/state/settings';
import HeapBlock from '@/heap/HeapBlock';
import HeapRow from '@/heap/HeapRow';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { GRID, HeapCurio, HeapDisplayMode } from '@/types/heap';
import bigInt from 'big-integer';
import NewCurioForm from './NewCurioForm';

function HeapChannel({ title }: ViewProps) {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();
  const channel = useChannel(flag, nest);
  const group = useGroup(flag);

  const navigate = useNavigate();
  const displayMode = useHeapDisplayMode(chFlag);
  const settings = useHeapSettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const curios = useCuriosForHeap(chFlag);

  const setDisplayMode = (setting: HeapDisplayMode) => {
    useHeapState.getState().viewHeap(chFlag, setting);
  };

  const setSortMode = (setting: 'time' | 'alpha') => {
    const newSettings = setSetting<HeapSetting>(
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
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  useDismissChannelNotifications({
    markRead: useHeapState.getState().markRead,
  });

  const renderCurio = useCallback(
    (curio: HeapCurio, time: bigInt.BigInteger) => (
      <div
        key={time.toString()}
        tabIndex={0}
        className="cursor-pointer"
        onClick={() => navigateToDetail(time)}
      >
        {displayMode === GRID ? (
          <HeapBlock curio={curio} time={time.toString()} />
        ) : (
          <HeapRow key={time.toString()} curio={curio} time={time.toString()} />
        )}
      </div>
    ),
    [displayMode, navigateToDetail]
  );

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
      <div className="p-4">
        <div
          className={cn(
            `heap-${displayMode}`,
            displayMode === 'grid' && 'grid-cols-minmax'
          )}
        >
          <NewCurioForm />
          {
            // Here, we sort the array by recently added and then filter out curios with a "replying" property
            // as those are comments and shouldn't show up in the main view
            Array.from(curios)
              .sort(([a], [b]) => b.compare(a))
              .filter(([, c]) => !c.heart.replying)
              .map(([time, curio]) => renderCurio(curio, time))
          }
        </div>
      </div>
    </Layout>
  );
}

export default HeapChannel;
