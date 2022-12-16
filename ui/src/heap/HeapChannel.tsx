import React, { useCallback, useEffect } from 'react';
import _ from 'lodash';
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
  GROUP_ADMIN,
  useAmAdmin,
} from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapState,
  useHeapPerms,
} from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';
import {
  HeapSetting,
  setSetting,
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
  createStorageKey,
} from '@/logic/utils';
import { GRID, HeapCurio, HeapDisplayMode, HeapSortMode } from '@/types/heap';
import useRecentChannel from '@/logic/useRecentChannel';
import NewCurioForm from './NewCurioForm';

function HeapChannel({ title }: ViewProps) {
  const navigate = useNavigate();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();
  const vessel = useVessel(flag, window.our);
  const channel = useChannel(flag, nest);
  const group = useGroup(flag);
  const { setRecentChannel } = useRecentChannel(flag);

  useEffect(() => {
    if (channel && !canReadChannel(channel, vessel, group?.bloc)) {
      navigate('../../activity');
      setRecentChannel('');
    }
  }, [group, channel, vessel, navigate, setRecentChannel]);

  const displayMode = useHeapDisplayMode(chFlag);
  const settings = useHeapSettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const curios = useCuriosForHeap(chFlag);
  const perms = useHeapPerms(chFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  const setDisplayMode = (setting: HeapDisplayMode) => {
    const newSettings = setSetting<HeapSetting>(
      settings,
      { displayMode: setting },
      chFlag
    );
    useSettingsState
      .getState()
      .putEntry('heaps', 'heapSettings', JSON.stringify(newSettings));
  };

  const setSortMode = (setting: HeapSortMode) => {
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
    setRecentChannel(nest);
  }, [chFlag, nest, setRecentChannel]);

  useDismissChannelNotifications({
    nest,
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
          <div className="aspect-h-1 aspect-w-1">
            <HeapBlock curio={curio} time={time.toString()} />
          </div>
        ) : (
          <HeapRow key={time.toString()} curio={curio} time={time.toString()} />
        )}
      </div>
    ),
    [displayMode, navigateToDetail]
  );

  const getCurioTitle = (curio: HeapCurio) =>
    curio.heart.title ||
    curio.heart.content.toString().split(' ').slice(0, 3).join(' ');

  const sortedCurios = Array.from(curios).sort(([a], [b]) => {
    if (sortMode === 'time') {
      return b.compare(a);
    }
    if (sortMode === 'alpha') {
      const curioA = curios.get(a);
      const curioB = curios.get(b);

      return getCurioTitle(curioA).localeCompare(getCurioTitle(curioB));
    }
    return b.compare(a);
  });

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
      <div className="h-full overflow-y-scroll p-4">
        <div
          className={cn(
            `heap-${displayMode}`,
            displayMode === 'grid' && 'grid-cols-minmax'
          )}
        >
          {canWrite ? <NewCurioForm /> : null}
          {
            // Here, we sort the array by recently added and then filter out curios with a "replying" property
            // as those are comments and shouldn't show up in the main view
            sortedCurios
              .filter(([, c]) => !c.heart.replying)
              .map(([time, curio]) => renderCurio(curio, time))
          }
        </div>
      </div>
    </Layout>
  );
}

export default HeapChannel;
