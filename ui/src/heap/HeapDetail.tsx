import React, { useEffect, Suspense } from 'react';
import { useParams } from 'react-router';
import { useCurio, useHeapState, useOrderedCurios } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups';
import { nestToFlag } from '@/logic/utils';
import { Link } from 'react-router-dom';
import bigInt from 'big-integer';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
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

  const { hasNext, hasPrev, nextCurio, prevCurio } = useOrderedCurios(
    chFlag,
    idCurio || ''
  );

  const curioHref = (id?: bigInt.BigInteger) => {
    if (!id) {
      return '/';
    }

    return `/groups/${groupFlag}/channels/heap/${chFlag}/curio/${id}`;
  };

  useEffect(() => {
    useHeapState.getState().initialize(chFlag);
  }, [chFlag]);

  if (!curio || !time) {
    return null;
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
      <Suspense fallback={<div>Loading...</div>}>
        <div className="flex flex-wrap lg:h-full lg:flex-nowrap">
          <div className="group relative flex-1">
            {hasNext ? (
              <Link
                to={curioHref(nextCurio?.[0])}
                className={
                  'absolute top-0 left-0 z-50 flex h-full w-16 flex-col items-center justify-center bg-transparent opacity-0 transition-opacity group-hover:opacity-100'
                }
              >
                <div className="h-8 w-8 bg-white p-1">
                  <CaretLeftIcon className="my-0 mx-auto block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            ) : null}
            <HeapDetailBody curio={curio} />
            {hasPrev ? (
              <Link
                to={curioHref(prevCurio?.[0])}
                className={
                  'absolute top-0 right-0 z-50 flex h-full w-16 flex-col items-center justify-center bg-transparent opacity-0 transition-opacity group-hover:opacity-100'
                }
              >
                <div className="h-8 w-8 bg-white p-1">
                  <CaretRightIcon className="my-0 mx-auto block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            ) : null}
          </div>
          <div className="mt-5 flex h-full w-full flex-col border-gray-50 bg-white lg:mt-0 lg:w-72 lg:border-l-2 xl:w-96">
            <HeapDetailSidebarInfo curio={curio} time={time} />
            <HeapDetailComments time={time} />
          </div>
        </div>
      </Suspense>
    </Layout>
  );
}
