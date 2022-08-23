import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup, useGroup, useChannel } from '@/state/groups/groups';
import { useCuriosForHeap, useHeapState } from '@/state/heap/heap';
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
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';

function HeapChannel(props: ViewProps) {
  const { title } = props;
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const flag = useRouteGroup();

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

  useDismissChannelNotifications();

  const channel = useChannel(flag, nest);
  const group = useGroup(flag);

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
      <Helmet>
        <title>
          {channel && group
            ? `${title} ${channel.meta.title} in ${group.meta.title}`
            : title}
        </title>
      </Helmet>
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
