import bigInt from 'big-integer';
import cn from 'classnames';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router';
import { Link, useLocation } from 'react-router-dom';

import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useFullChannel } from '@/logic/channel';
import getKindDataFromEssay from '@/logic/getKindData';
import { useGroupsAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';
import {
  useIsPostUndelivered,
  useOrderedPosts,
  usePost,
} from '@/state/channel/channel';
import { useRouteGroup } from '@/state/groups';
import { Post, newReplyMap } from '@/types/channel';
import { ViewProps } from '@/types/groups';

import HeapDetailBody from './HeapDetail/HeapDetailBody';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailComments from './HeapDetail/HeapDetailSidebar/HeapDetailComments';
import HeapDetailSidebarInfo from './HeapDetail/HeapDetailSidebar/HeapDetailSidebarInfo';

export default function HeapDetail({ title }: ViewProps) {
  const location = useLocation();
  const groupFlag = useRouteGroup();
  const { chShip, chName, idTime } = useParams<{
    chShip: string;
    chName: string;
    idTime: string;
  }>();
  const chFlag = `${chShip}/${chName}`;
  const nest = `heap/${chFlag}`;
  const { group, groupChannel: channel } = useFullChannel({
    groupFlag,
    nest,
  });
  const isMobile = useIsMobile();
  const { post: note, isLoading } = usePost(nest, idTime || '');
  const { title: curioTitle } = getKindDataFromEssay(note.essay);
  const { isChatInputFocused } = useChatInputFocus();
  const showTabBar = useShowTabBar();
  const shouldApplyPaddingBottom = showTabBar && !isChatInputFocused;
  const { nextPost: nextNote, prevPost: prevNote } = useOrderedPosts(
    nest,
    idTime || ''
  );
  const initialNote = location.state?.initialCurio as Post | undefined;
  const essay = note?.essay || initialNote?.essay;
  const isUndelivered = useIsPostUndelivered(initialNote);

  const curioHref = (id?: bigInt.BigInteger) => {
    if (!id) {
      return '/';
    }

    return `/groups/${groupFlag}/channels/heap/${chFlag}/curio/${id}`;
  };

  useGroupsAnalyticsEvent({
    name: 'view_item',
    groupFlag,
    chFlag,
    channelType: 'heap',
  });

  // we have no data at all just show spinner
  if (!essay && isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // with at least an essay we can show content and wait for everything else
  return (
    <Layout
      style={{
        paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
      }}
      className="padding-bottom-transition flex-1 bg-white"
      header={
        <HeapDetailHeader
          nest={nest}
          isUndelivered={isUndelivered}
          idCurio={idTime || ''}
          essay={essay}
          groupFlag={groupFlag}
        />
      }
    >
      <Helmet>
        <title>
          {note && channel && group
            ? `${curioTitle || 'Gallery Item'} in ${channel.meta.title} • ${
                group.meta.title || ''
              } ${title}`
            : title}
        </title>
      </Helmet>
      <div className="flex h-full flex-col overflow-y-auto lg:flex-row">
        <div className="group relative flex flex-1">
          {nextNote ? (
            <div className="absolute left-0 top-0 flex h-full w-16 flex-col justify-center">
              <Link
                to={curioHref(nextNote[0])}
                className={cn(
                  ' z-40 flex h-16 w-16 flex-col items-center justify-center bg-transparent',
                  !isMobile &&
                    'opacity-0 transition-opacity group-hover:opacity-100'
                )}
              >
                <div className="h-8 w-8 rounded border-gray-300 bg-white p-[3px]">
                  <CaretLeftIcon className="mx-auto my-0 block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            </div>
          ) : null}
          <HeapDetailBody essay={essay} />
          {prevNote ? (
            <div className="absolute right-0 top-0 flex h-full w-16 flex-col justify-center">
              <Link
                to={curioHref(prevNote[0])}
                className={cn(
                  ' z-40 flex h-16 w-16 flex-col items-center justify-center bg-transparent',
                  !isMobile &&
                    'opacity-0 transition-opacity group-hover:opacity-100'
                )}
              >
                <div className="h-8 w-8 rounded border-gray-300 bg-white p-[3px]">
                  <CaretRightIcon className="mx-auto my-0 block h-6 w-6 text-gray-300" />
                </div>
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col lg:h-full lg:w-72 lg:border-l-2 lg:border-gray-50 xl:w-96">
          <HeapDetailSidebarInfo essay={essay} />
          {idTime && (
            <HeapDetailComments
              time={idTime}
              comments={note.seal.replies}
              loading={isLoading}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
