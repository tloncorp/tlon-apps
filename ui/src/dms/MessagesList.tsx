import React, { PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useMessageSort from '@/logic/useMessageSort';
import { filters, SidebarFilter } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
<<<<<<< HEAD
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { DMUnread } from '@/types/dms';
import { useUnreads, useChats } from '@/state/channel/channel';
import { useGroups } from '@/state/groups';
import { canReadChannel } from '@/logic/channel';
||||||| 0c006213
import { canReadChannel, whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { ChatBrief } from '@/types/chat';
=======
import { canReadChannel, whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { ChatBrief } from '@/types/chat';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
>>>>>>> develop
import {
  usePendingDms,
  usePendingMultiDms,
  usePinned,
<<<<<<< HEAD
  useDmUnreads,
||||||| 0c006213
  useChats,
=======
  useChats,
  useDms,
  useMultiDms,
>>>>>>> develop
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

type MessagesListProps = PropsWithChildren<{
  filter: SidebarFilter;
  atTopChange?: (atTop: boolean) => void;
  isScrolling?: (scrolling: boolean) => void;
}>;

function itemContent(_i: number, [whom, _unread]: [string, DMUnread]) {
  return (
    <div className="px-4 sm:px-2">
      <MessagesSidebarItem key={whom} whom={whom} />
    </div>
  );
}

const computeItemKey = (_i: number, [whom, _unread]: [string, DMUnread]) =>
  whom;

let virtuosoState: StateSnapshot | undefined;

export default function MessagesList({
  filter,
  atTopChange,
  isScrolling,
  children,
}: MessagesListProps) {
  const pending = usePendingDms();
  const pendingMultis = usePendingMultiDms();
  const pinned = usePinned();
  const { sortMessages } = useMessageSort();
  const { data: dmUnreads } = useDmUnreads();
  const channelUnreads = useUnreads();
  const unreads = useMemo(
    () => ({
      ...channelUnreads,
      ...dmUnreads,
    }),
    [channelUnreads, dmUnreads]
  );
  const chats = useChats();
  const dms = useDms();
  const multiDms = useMultiDms();
  const groups = useGroups();
  const allPending = pending.concat(pendingMultis);
  const isMobile = useIsMobile();
  const thresholds = {
    atBottomThreshold: 125,
    atTopThreshold: 125,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const organizedUnreads = useMemo(
    () =>
      sortMessages(unreads).filter(([b]) => {
        const chat = chats[b];
        const groupFlag = chat?.perms.group;
        const group = groups[groupFlag || ''];
        const vessel = group?.fleet[window.our];
<<<<<<< HEAD
        const channel = group?.channels[b];
||||||| 0c006213
        const channel = group?.channels[`chat/${b}`];
=======
        const channel = group?.channels[`chat/${b}`];
        const club = multiDms[b];
        const dm = dms.filter((d) => d === b)[0];

        if (whomIsMultiDm(b) && !club) {
          return false;
        }

        if (whomIsMultiDm(b) && !club.team.includes(window.our)) {
          return false;
        }

        if (whomIsDm(b) && !dm) {
          return false;
        }
>>>>>>> develop

        if (
          chat &&
          channel &&
          vessel &&
          !canReadChannel(channel, vessel, group?.bloc)
        ) {
          return false;
        }

        if (pinned.includes(b)) {
          return false;
        }

        if (allPending.includes(b)) {
          return false;
        }

        if (filter === filters.groups && (whomIsDm(b) || whomIsMultiDm(b))) {
          return false;
        }

        if (filter === filters.dms && b.includes('/')) {
          return false;
        }

        if (b.includes('/') && !group) {
          return false;
        }

        return true; // is all
      }),
<<<<<<< HEAD
    [allPending, unreads, filter, pinned, sortMessages, chats, groups]
||||||| 0c006213
    [allPending, briefs, chats, filter, groups, pinned, sortMessages]
=======
    [
      allPending,
      briefs,
      chats,
      filter,
      groups,
      pinned,
      sortMessages,
      dms,
      multiDms,
    ]
>>>>>>> develop
  );

<<<<<<< HEAD
  console.log({
    unreads,
    chats,
    organizedUnreads,
  });

  const headerHeightRef = useRef<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);
||||||| 0c006213
=======
  const headerHeightRef = useRef<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);
>>>>>>> develop
  const head = useMemo(
    () => (
      <div ref={headerRef}>
        {children}
        {allPending &&
          filter !== filters.groups &&
          allPending.map((whom) => (
            <div key={whom} className="px-4 sm:px-2">
              <MessagesSidebarItem pending key={whom} whom={whom} />
            </div>
          ))}
      </div>
    ),
    [headerRef, children, allPending, filter]
  );

  useEffect(() => {
    if (!headerRef.current) {
      return () => {
        // do nothing
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      headerHeightRef.current =
        headerRef.current?.offsetHeight ?? headerHeightRef.current;
    });

    resizeObserver.observe(headerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const components = useMemo(
    () => ({
      Header: () => head,
      EmptyPlaceholder: () =>
        isMobile ? (
          <EmptyPlaceholder>
            Your direct messages will be shown here
          </EmptyPlaceholder>
        ) : null,
    }),
    [head, isMobile]
  );

  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    const currentVirtuosoRef = virtuosoRef.current;

    return () => {
      currentVirtuosoRef?.getState((state) => {
        virtuosoState = {
          ...state,
          // Virtuoso contains a bug where `scrollTop` includes the Header's size,
          // though it's treated relatively to the List component when applied.
          scrollTop: state.scrollTop - (headerHeightRef.current ?? 0),
        };
      });
    };
  }, []);

  return (
    <Virtuoso
      {...thresholds}
<<<<<<< HEAD
      ref={virtuosoRef}
      data={organizedUnreads}
||||||| 0c006213
      data={organizedBriefs}
=======
      ref={virtuosoRef}
      data={organizedBriefs}
>>>>>>> develop
      computeItemKey={computeItemKey}
      itemContent={itemContent}
      components={components}
      atTopStateChange={atTopChange}
      isScrolling={isScrolling}
      restoreStateFrom={virtuosoState}
      className="w-full overflow-x-hidden"
    />
  );
}
