import _ from 'lodash';
import React, { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useCuriosForHeap, useHeapState } from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';
import { nestToFlag } from '@/logic/utils';
import HeapBlock from './HeapBlock';
import HeapRow from './HeapRow';
import HeapInput from './HeapInput';
import { GRID, HeapDisplayMode } from './HeapTypes';

export interface HeapChannelProps {
  flag: string;
  nest: string;
}

function HeapChannel({ flag, nest }: HeapChannelProps) {
  // naive displayType implementation, we need to figure out where this should live.
  const [displayType, setDisplayType] = React.useState<HeapDisplayMode>(GRID);
  const [app, chFlag] = nestToFlag(nest);
  const curios = useCuriosForHeap(chFlag);

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  return (
    <Layout
      className="flex-1 bg-gray-50"
      aside={<Outlet />}
      header={
        <ChannelHeader
          flag={flag}
          nest={nest}
          displayType={displayType}
          setDisplayType={setDisplayType}
        />
      }
    >
      <div className="p-4">
        {displayType === 'grid' ? (
          <div className="grid grid-cols-1 justify-center justify-items-center gap-4 sm:grid-cols-[repeat(auto-fit,minmax(auto,250px))]">
            <HeapInput displayType={displayType} />
            {Array.from(curios)
              .sort(([a], [b]) => b.compare(a))
              .map(([time, curio]) => (
                <Suspense
                  key={time.toString()}
                  fallback={<div>Loading...</div>}
                >
                  <HeapBlock curio={curio} />
                </Suspense>
              ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:grid-cols-[repeat(auto-fit,minmax(auto,250px))]">
            <HeapInput displayType={displayType} />
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
