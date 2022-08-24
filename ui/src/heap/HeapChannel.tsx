import React, { Suspense, useCallback, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router';
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

  const navigate = useNavigate();
  // for now displayMode and sortMode will be in the settings store.
  // in the future we will want to store in this via the heap agent.
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

  const navigateToDetail = useCallback(
    (time: bigInt.BigInteger) => {
      navigate(`curio/${time}`);
    },
    [navigate]
  );

  useDismissChannelNotifications({
    markRead: useHeapState.getState().markRead,
  });

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
            {
              // Here, we sort the array by recently added and then filter out curios with a "replying" property
              // as those are comments and shouldn't show up in the main view
              Array.from(curios)
                .sort(([a], [b]) => b.compare(a))
                .filter(([, c]) => !c.heart.replying)
                .map(([time, curio]) => (
                  <Suspense
                    key={time.toString()}
                    fallback={<div>Loading...</div>}
                  >
                    <div tabIndex={0} onClick={() => navigateToDetail(time)}>
                      <HeapBlock
                        curio={curio}
                        // @ts-expect-error time is apparently a number, or we have a problem in heap types.
                        time={time}
                      />
                    </div>
                  </Suspense>
                ))
            }
          </div>
        ) : (
          <div className="heap-list">
            <HeapInput displayType={displayMode} />
            {
              // Here, we sort the array by recently added and then filter out curios with a "replying" property
              // as those are comments and shouldn't show up in the main view
              Array.from(curios)
                .sort(([a], [b]) => b.compare(a))
                .filter(([, c]) => !c.heart.replying)
                .map(([time, curio]) => (
                  <Suspense
                    key={time.toString()}
                    fallback={<div>Loading...</div>}
                  >
                    <HeapRow
                      curio={curio}
                      // @ts-expect-error time is apparently a number, or we have a problem in heap types.
                      time={time}
                    />
                  </Suspense>
                ))
            }
          </div>
        )}
      </div>
    </Layout>
  );
}

export default HeapChannel;
