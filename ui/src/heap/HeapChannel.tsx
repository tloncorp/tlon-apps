import _ from 'lodash';
import React, { Suspense, useCallback, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup, useVessel } from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapPerms,
  useHeapState,
} from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';
import {
  setHeapSetting,
  useHeapDisplayMode,
  useHeapSettings,
  useHeapSortMode,
  useSettingsState,
} from '@/state/settings';
import HeapBlock from '@/heap/HeapBlock';
import HeapRow from '@/heap/HeapRow';
import HeapInput from '@/heap/HeapInput';

interface CurioForm {
  url: string;
}

function HeapChannel() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();

  const navigate = useNavigate();
  // for now displayMode and sortMode will be in the settings store.
  // in the future we will want to store in this via the heap agent.
  const displayMode = useHeapDisplayMode(chFlag);
  const settings = useHeapSettings();
  // for now sortMode is not actually doing anything.
  // need input from design/product on what we want it to actually do, it's not spelled out in figma.
  const sortMode = useHeapSortMode(chFlag);
  const curios = useCuriosForHeap(chFlag);

  const setDisplayMode = (setting: 'list' | 'grid') => {
    const newSettings = setHeapSetting(
      settings,
      { displayMode: setting },
      chFlag
    );
    useSettingsState
      .getState()
      .putEntry('heaps', 'heapSettings', JSON.stringify(newSettings));
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

  const navigateToDetail = useCallback((time: bigInt.BigInteger) => {
    navigate(`curio/${time}`);
  }, [navigate]);

  return (
    <Layout
      className="flex-1 bg-gray-50"
      aside={<Outlet />}
      header={
        <ChannelHeader
          flag={flag}
          nest={nest}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      }
    >
      <div className="p-4">
        {displayMode === 'grid' ? (
          <div className="grid grid-cols-1 justify-center justify-items-center gap-4 sm:grid-cols-[repeat(auto-fit,minmax(auto,250px))]">
            <HeapInput displayType={displayMode} />
            {Array.from(curios)
              .sort(([a], [b]) => b.compare(a))
              .map(([time, curio]) => (
                <Suspense
                  key={time.toString()}
                  fallback={<div>Loading...</div>}
                >
                  <div
                    onClick={() => navigateToDetail(time)}
                  >
                    <HeapBlock curio={curio} />
                  </div>
                </Suspense>
              ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:grid-cols-[repeat(auto-fit,minmax(auto,250px))]">
            <HeapInput displayType={displayMode} />
            {Array.from(curios)
              .sort(([a], [b]) => b.compare(a))
              .map(([time, curio]) => (
                <Suspense
                  key={time.toString()}
                  fallback={<div>Loading...</div>}
                >
                  <HeapRow curio={curio} />
                </Suspense>
              ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default HeapChannel;
