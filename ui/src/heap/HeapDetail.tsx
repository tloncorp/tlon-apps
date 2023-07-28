import bigInt from 'big-integer';
import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router';
import {
  useCurioWithCommentsNew,
  useHeapState,
  useOrderedCuriosNew,
} from '@/state/heap/heap';
import Layout from '@/components/Layout/Layout';
import { useChannel, useGroup, useRouteGroup, useVessel } from '@/state/groups';
import { canReadChannel } from '@/logic/utils';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useChannelIsJoined } from '@/logic/channel';
import { useGroupsAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { ViewProps } from '@/types/groups';
import HeapDetailSidebarInfo from './HeapDetail/HeapDetailSidebar/HeapDetailSidebarInfo';
import HeapDetailComments from './HeapDetail/HeapDetailSidebar/HeapDetailComments';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailBody from './HeapDetail/HeapDetailBody';

export default function HeapDetail({ title }: ViewProps) {
  const [joining, setJoining] = useState(false);
  const groupFlag = useRouteGroup();
  const { chShip, chName, idCurio } = useParams<{
    chShip: string;
    chName: string;
    idCurio: string;
  }>();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const channel = useChannel(groupFlag, nest);
  const vessel = useVessel(groupFlag, window.our);
  const group = useGroup(groupFlag);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const joined = useChannelIsJoined(nest);
  const { time, curio, comments, isLoading } = useCurioWithCommentsNew(
    chFlag,
    idCurio || ''
  );
  // const { hasNext, hasPrev, nextCurio, prevCurio } = useOrderedCurios(
  //   chFlag,
  //   time || ''
  // );
  const { hasNext, hasPrev, nextCurio, prevCurio } = useOrderedCuriosNew(
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
  }, [chFlag]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel]);

  useEffect(() => {
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

  useGroupsAnalyticsEvent({
    name: 'view_item',
    groupFlag,
    chFlag,
    channelType: 'heap',
  });

  // TODO handle curio not found
  if (isLoading || !curio) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
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
      <Helmet>
        <title>
          {curio && channel && group
            ? `${curio.heart.title || 'Gallery Item'} in ${
                channel.meta.title
              } • ${group.meta.title || ''} ${title}`
            : title}
        </title>
      </Helmet>
      <div className="flex h-full flex-col overflow-y-auto lg:flex-row">
        <div className="group relative flex flex-1">
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
              <HeapDetailComments time={time} comments={comments} />
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
