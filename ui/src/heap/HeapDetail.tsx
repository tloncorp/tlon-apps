import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useHeapState, useOrderedCurios } from '@/state/heap/heap';
import Layout from '@/components/Layout/Layout';
import { useChannel, useGroup, useRouteGroup, useVessel } from '@/state/groups';
import { canReadChannel, isChannelJoined } from '@/logic/utils';
import { Link } from 'react-router-dom';
import bigInt from 'big-integer';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { useEventListener } from 'usehooks-ts';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import useLeap from '@/components/Leap/useLeap';
import useAllBriefs from '@/logic/useAllBriefs';
import keyMap from '@/keyMap';
import HeapDetailSidebarInfo from './HeapDetail/HeapDetailSidebar/HeapDetailSidebarInfo';
import HeapDetailComments from './HeapDetail/HeapDetailSidebar/HeapDetailComments';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailBody from './HeapDetail/HeapDetailBody';
import useCurioFromParams from './useCurioFromParams';

export default function HeapDetail() {
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const { chShip, chName } = useParams<{ chShip: string; chName: string }>();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const channel = useChannel(groupFlag, nest);
  const vessel = useVessel(groupFlag, window.our);
  const group = useGroup(groupFlag);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const briefs = useAllBriefs();
  const joined = Object.keys(briefs).some((k) => k.includes('heap/'))
    ? isChannelJoined(nest, briefs)
    : true;
  const { time, curio } = useCurioFromParams();
  const [loading, setLoading] = useState(false);
  const { isOpen: leapIsOpen } = useLeap();

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

  const joinChannel = useCallback(async () => {
    setJoining(true);
    await useHeapState.getState().joinHeap(groupFlag, chFlag);
    setJoining(false);
  }, [chFlag, groupFlag]);

  const initializeChannel = useCallback(async () => {
    await useHeapState.getState().initialize(chFlag);
    setLoading(false);
  }, [chFlag]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel]);

  useEffect(() => {
    setLoading(true);

    if (joined && canRead && !joining) {
      initializeChannel();
    }
  }, [
    time,
    curio,
    joined,
    joinChannel,
    canRead,
    channel,
    joining,
    initializeChannel,
  ]);

  useEventListener('keydown', (e) => {
    if (leapIsOpen) return;
    switch (e.key) {
      case keyMap.curio.close: {
        navigate('..');
        break;
      }
      case keyMap.curio.next: {
        if (hasPrev) {
          navigate(curioHref(prevCurio?.[0]));
        }
        break;
      }
      case keyMap.curio.prev: {
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

  return loading ? (
    <div className="flex flex-1 items-center justify-center">
      <LoadingSpinner />
    </div>
  ) : (
    <Layout
      className="flex-1 bg-white"
      header={
        <HeapDetailHeader
          flag={groupFlag}
          chFlag={chFlag}
          idCurio={time?.toString() || ''}
        />
      }
    >
      <div className="flex h-full flex-col overflow-y-auto lg:flex-row">
        <div className="flex flex-1">
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
          {curio ? <HeapDetailBody curio={curio} /> : null}
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
        <div className="flex w-full flex-col lg:h-full lg:w-72 lg:border-l-2 lg:border-gray-50 xl:w-96">
          {curio && time ? (
            <>
              <HeapDetailSidebarInfo curio={curio} />
              <HeapDetailComments time={time} />
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
