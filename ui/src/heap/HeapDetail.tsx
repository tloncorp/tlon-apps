import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useHeapState, useOrderedCurios } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups';
import { nestToFlag } from '@/logic/utils';
import { Link } from 'react-router-dom';
import bigInt from 'big-integer';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { useEventListener } from 'usehooks-ts';
import HeapDetailSidebarInfo from './HeapDetail/HeapDetailSidebar/HeapDetailSidebarInfo';
import HeapDetailComments from './HeapDetail/HeapDetailSidebar/HeapDetailComments';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailBody from './HeapDetail/HeapDetailBody';
import useCurioFromParams from './useCurioFromParams';

export default function HeapDetail() {
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const { time, curio } = useCurioFromParams();

  const { hasNext, hasPrev, nextCurio, prevCurio } = useOrderedCurios(
    chFlag,
    time || ''
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

  useEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape': {
        navigate('..');
        break;
      }
      case 'ArrowRight': {
        if (hasPrev) {
          navigate(curioHref(prevCurio?.[0]));
        }
        break;
      }
      case 'ArrowLeft': {
        if (hasNext) {
          navigate(curioHref(nextCurio?.[0]));
        }
        break;
      }
      default: {
        break;
      }
    }
  });

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
          idCurio={time.toString() || ''}
        />
      }
    >
      <div className="flex h-full w-full flex-col overflow-y-auto lg:flex-row">
        <div className="group relative flex-1">
          {hasNext ? (
            <div className="absolute top-0 left-0 flex h-full w-16 flex-col justify-center">
              <Link
                to={curioHref(nextCurio?.[0])}
                className={
                  'z-40 flex h-16 w-16 flex-col items-center justify-center bg-transparent opacity-0 transition-opacity group-hover:opacity-100'
                }
              >
                <div className="h-8 w-8 rounded border-gray-300 bg-white p-[3px]">
                  <CaretLeftIcon className="my-0 mx-auto block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            </div>
          ) : null}
          <HeapDetailBody curio={curio} />
          {hasPrev ? (
            <div className="absolute top-0 right-0 flex h-full w-16 flex-col justify-center">
              <Link
                to={curioHref(prevCurio?.[0])}
                className={
                  'z-40 flex h-16 w-16 flex-col items-center justify-center bg-transparent opacity-0 transition-opacity group-hover:opacity-100'
                }
              >
                <div className="h-8 w-8 rounded border-gray-300 bg-white p-[3px]">
                  <CaretRightIcon className="my-0 mx-auto block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col border-gray-50 bg-white sm:mt-5 lg:mt-0 lg:h-full lg:w-72 lg:border-l-2 xl:w-96">
          <HeapDetailSidebarInfo curio={curio} />
          <HeapDetailComments time={time} />
        </div>
      </div>
    </Layout>
  );
}
