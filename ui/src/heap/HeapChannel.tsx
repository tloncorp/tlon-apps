import _ from 'lodash';
import React, { useEffect } from 'react';
import { Outlet } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useVessel } from '@/state/groups/groups';
import {
  useCuriosForHeap,
  useHeapPerms,
  useHeapState,
} from '@/state/heap/heap';
import ChannelHeader from '@/channels/ChannelHeader';

export interface HeapChannelProps {
  flag: string;
  nest: string;
}

function HeapChannel({ flag, nest }: HeapChannelProps) {
  useEffect(() => {
    useHeapState.getState().initialize(nest);
  }, [nest]);

  const curios = useCuriosForHeap(nest);
  const perms = useHeapPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;

  return (
    <Layout
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      <div className="h-20 w-20 bg-red" />
    </Layout>
  );
}

export default HeapChannel;
