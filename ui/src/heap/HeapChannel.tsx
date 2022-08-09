import _ from 'lodash';
import React, { Suspense, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useVessel } from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapPerms,
  useHeapState,
} from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';
import { nestToFlag } from '@/logic/utils';
import { useForm } from 'react-hook-form';
import HeapBlock from './HeapBlock';
import HeapRow from './HeapRow';

export interface HeapChannelProps {
  flag: string;
  nest: string;
}

interface CurioForm {
  url: string;
}

function HeapChannel({ flag, nest }: HeapChannelProps) {
  // naive displayType implementation, we need to figure out where this should live.
  const [displayType, setDisplayType] = React.useState<'grid' | 'list'>('grid');
  const [app, chFlag] = nestToFlag(nest);
  const curios = useCuriosForHeap(chFlag);
  const perms = useHeapPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { register, handleSubmit, reset } = useForm<CurioForm>({
    defaultValues: {
      url: '',
    },
  });
  const onSubmit = useCallback(
    ({ url }: CurioForm) => {
      useHeapState.getState().addCurio(chFlag, {
        title: null,
        content: [url],
        author: window.our,
        sent: Date.now(),
        replying: null,
      });

      reset();
    },
    [chFlag, reset]
  );

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
            <form onSubmit={handleSubmit(onSubmit)}>
              <input type="url" {...register('url')} placeholder="Enter url" />
            </form>
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
            <form onSubmit={handleSubmit(onSubmit)}>
              <input type="url" {...register('url')} placeholder="Enter url" />
            </form>
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
