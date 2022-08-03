import _ from 'lodash';
import React, { useCallback, useEffect } from 'react';
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

export interface HeapChannelProps {
  flag: string;
  nest: string;
}

interface CurioForm {
  url: string;
}

function HeapChannel({ flag, nest }: HeapChannelProps) {
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
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      <div className="p-4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="url" {...register('url')} placeholder="Enter url" />
        </form>
        <ul>
          {Array.from(curios)
            .sort(([a], [b]) => b.compare(a))
            .map(([time, curio]) => (
              <li key={time.toString()}>
                <img src={(curio.heart.content[0] as string) || ''} />
              </li>
            ))}
        </ul>
      </div>
    </Layout>
  );
}

export default HeapChannel;
