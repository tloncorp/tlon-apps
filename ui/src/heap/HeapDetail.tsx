import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { useCurio, useHeapState } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups';
import { nestToFlag } from '@/logic/utils';
import HeapDetailSidebarInfo from './HeapDetail/HeapDetailSidebar/HeapDetailSidebarInfo';
import HeapDetailComments from './HeapDetail/HeapDetailSidebar/HeapDetailComments';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailBody from './HeapDetail/HeapDetailBody';

export default function HeapDetail() {
  const groupFlag = useRouteGroup();
  const nest = useNest();
  const { idCurio } = useParams();
  const [, chFlag] = nestToFlag(nest);
  const curioObject = useCurio(chFlag, idCurio || '');
  const curio = curioObject ? curioObject[1] : null;
  const time = curioObject ? curioObject[0] : null;

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  if (!curio || !time) {
    return <div />;
  }

  return (
    <Layout
      className="flex-1 bg-gray-50"
      header={
        <HeapDetailHeader
          flag={groupFlag}
          chFlag={chFlag}
          idCurio={idCurio || ''}
        />
      }
    >
      <div className="flex flex-wrap lg:h-full lg:flex-nowrap">
        <HeapDetailBody curio={curio} />
        <div className="mt-5 flex h-full w-full flex-col border-gray-50 bg-white lg:mt-0 lg:w-72 lg:border-l-2 xl:w-96">
          <HeapDetailSidebarInfo curio={curio} time={time} />
          <HeapDetailComments time={time} />
        </div>
      </div>
    </Layout>
  );
}
