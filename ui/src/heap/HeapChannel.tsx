import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapDisplayMode,
  useHeapState,
} from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';
import {
  setHeapSetting,
  useHeapSettings,
  useHeapSortMode,
  useSettingsState,
} from '@/state/settings';
import HeapBlock from '@/heap/HeapBlock';
import HeapRow from '@/heap/HeapRow';
import HeapInput from '@/heap/HeapInput';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import { HeapDisplayMode } from '@/types/heap';

function HeapChannel() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();

  const displayMode = useHeapDisplayMode(chFlag);
  // for now sortMode will be in the settings store.
  // in the future we will want to store in this via the heap agent.
  const settings = useHeapSettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const curios = useCuriosForHeap(chFlag);

  const setDisplayMode = (setting: HeapDisplayMode) => {
    useHeapState.getState().viewHeap(chFlag, setting);
  };

  const setSortMode = (setting: 'time' | 'alpha') => {
    const newSettings = setHeapSetting(settings, { sortMode: setting }, chFlag);
    useSettingsState
      .getState()
      .putEntry('heaps', 'heapSettings', JSON.stringify(newSettings));
  };

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  useDismissChannelNotifications();

  return (
    <Layout
      className="flex-1 bg-gray-50"
      aside={<Outlet />}
      header={
        <ChannelHeader
          flag={flag}
          nest={nest}
          isHeap
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      }
    >
      <div className="p-4">
        {displayMode === 'grid' ? (
          <div className="heap-grid">
            <HeapInput displayType={displayMode} />
            {Array.from(curios)
              .sort(([a], [b]) => b.compare(a))
              .map(([time, curio]) => (
                <HeapBlock
                  key={time.toString()}
                  curio={curio}
                  time={time.toString()}
                />
              ))}
          </div>
        ) : (
          <div className="heap-list">
            <HeapInput displayType={displayMode} />
            {Array.from(curios)
              .sort(([a], [b]) => b.compare(a))
              .map(([time, curio]) => (
                <HeapRow curio={curio} time={time.toString()} />
              ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default HeapChannel;
