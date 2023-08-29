import bigInt from 'big-integer';
import cn from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { useParams } from 'react-router';
import {
  useCurioWithComments,
  useOrderedCurios,
  useJoinHeapMutation,
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
import { useIsMobile } from '@/logic/useMedia';
import { HeapCurio } from '@/types/heap';
import HeapDetailSidebarInfo from './HeapDetail/HeapDetailSidebar/HeapDetailSidebarInfo';
import HeapDetailComments from './HeapDetail/HeapDetailSidebar/HeapDetailComments';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailBody from './HeapDetail/HeapDetailBody';

export default function HeapDetail({ title }: ViewProps) {
  const [joining, setJoining] = useState(false);
  const location = useLocation();
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
  const isMobile = useIsMobile();
  const joined = useChannelIsJoined(nest);
  const { mutateAsync: joinHeap } = useJoinHeapMutation();
  const {
    time,
    curio: fetchedCurio,
    comments,
    isLoading: curioLoading,
  } = useCurioWithComments(chFlag, idCurio || '');
  const { hasNext, hasPrev, nextCurio, prevCurio } = useOrderedCurios(
    chFlag,
    time || ''
  );
  const initialCurio = location.state?.initialCurio as HeapCurio | undefined;
  const curio = fetchedCurio || initialCurio;

  const curioHref = (id?: bigInt.BigInteger) => {
    if (!id) {
      return '/';
    }

    return `/groups/${groupFlag}/channels/heap/${chFlag}/curio/${id}`;
  };

  const joinChannel = useCallback(async () => {
    setJoining(true);
    await joinHeap({ group: groupFlag, chan: chFlag });
    setJoining(false);
  }, [chFlag, groupFlag, joinHeap]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel]);

  useGroupsAnalyticsEvent({
    name: 'view_item',
    groupFlag,
    chFlag,
    channelType: 'heap',
  });

  // TODO handle curio not found
  if (!curio) {
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
                className={cn(
                  ' z-40 flex h-16 w-16 flex-col items-center justify-center bg-transparent',
                  !isMobile &&
                    'opacity-0 transition-opacity group-hover:opacity-100'
                )}
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
                className={cn(
                  ' z-40 flex h-16 w-16 flex-col items-center justify-center bg-transparent',
                  !isMobile &&
                    'opacity-0 transition-opacity group-hover:opacity-100'
                )}
              >
                <div className="h-8 w-8 rounded border-gray-300 bg-white p-[3px]">
                  <CaretRightIcon className="my-0 mx-auto block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col lg:h-full lg:w-72 lg:border-l-2 lg:border-gray-50 xl:w-96">
          {curio && <HeapDetailSidebarInfo curio={curio} />}
          {time && (
            <HeapDetailComments
              time={time}
              comments={comments}
              loading={curioLoading}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
