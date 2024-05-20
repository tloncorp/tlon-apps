import { ActivitySummary } from '@tloncorp/shared/dist/urbit/activity';
import { deSig } from '@urbit/api';
import React, { PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { InlineEmptyPlaceholder } from '@/components/EmptyPlaceholder';
import { canReadChannel } from '@/logic/channel';
import { useIsMobile } from '@/logic/useMedia';
import useMessageSort from '@/logic/useMessageSort';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { useUnreads } from '@/state/activity';
import { useChats } from '@/state/channel/channel';
import { useContacts } from '@/state/contact';
import { useGroups } from '@/state/groups';
import { usePinnedChats } from '@/state/pins';
import { SidebarFilter, filters } from '@/state/settings';

import { useMultiDms, usePendingDms, usePendingMultiDms } from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

type MessagesListProps = PropsWithChildren<{
  filter: SidebarFilter;
  searchQuery?: string;
  atTopChange?: (atTop: boolean) => void;
  isScrolling?: (scrolling: boolean) => void;
}>;

function itemContent(_i: number, [whom, _unread]: [string, ActivitySummary]) {
  return (
    <div className="px-4 sm:px-2">
      <MessagesSidebarItem key={whom} whom={whom} />
    </div>
  );
}

const computeItemKey = (
  _i: number,
  [whom, _unread]: [string, ActivitySummary]
) => whom;

let virtuosoState: StateSnapshot | undefined;

export default function MessagesList({
  filter,
  searchQuery,
  atTopChange,
  isScrolling,
  children,
}: MessagesListProps) {
  const { pending } = usePendingDms();
  const pendingMultis = usePendingMultiDms();
  const pinned = usePinnedChats();
  const { sortMessages } = useMessageSort();
  const unreads = useUnreads();
  const contacts = useContacts();
  const clubs = useMultiDms();
  const chats = useChats();
  const groups = useGroups();
  const allPending = pending.concat(pendingMultis);
  const hasPending = allPending && allPending.length > 0;
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
      sortMessages(unreads).filter(([key]) => {
        if (key === 'base') {
          return false;
        }

        const chat = chats[key];
        const groupFlag = chat?.perms.group;
        const group = groups[groupFlag || ''];
        const vessel = group?.fleet[window.our];
        const channel = group?.channels[key];
        const isChannel = key.includes('/');
        const isDm = whomIsDm(key);
        const isMultiDm = whomIsMultiDm(key);

        if (
          chat &&
          channel &&
          vessel &&
          !canReadChannel(channel, vessel, group?.bloc)
        ) {
          return false;
        }

        if (pinned.includes(key) && !searchQuery) {
          return false;
        }

        if (allPending.includes(key)) {
          return false;
        }

        if (filter === filters.groups && (isDm || isMultiDm)) {
          return false;
        }

        if (filter === filters.dms && isChannel) {
          return false;
        }

        if (!group && isChannel) {
          return false;
        }

        if (searchQuery) {
          if (isChannel) {
            const titleMatch = channel.meta.title
              .toLowerCase()
              .startsWith(searchQuery.toLowerCase());
            const shipMatch = deSig(key)?.startsWith(deSig(searchQuery) || '');
            return titleMatch || shipMatch;
          }

          if (isDm) {
            const contact = contacts[key];
            const nicknameMatch = contact?.nickname
              .toLowerCase()
              .startsWith(searchQuery.toLowerCase());
            const shipMatch = deSig(key)?.startsWith(deSig(searchQuery) || '');
            return nicknameMatch || shipMatch;
          }

          if (isMultiDm) {
            const club = clubs[key];
            const titleMatch = club?.meta.title
              ?.toLowerCase()
              .startsWith(searchQuery.toLowerCase());
            const shipsMatch = club?.hive?.some((ship) =>
              deSig(ship)?.startsWith(deSig(searchQuery) || '')
            );
            return titleMatch || shipsMatch;
          }
        }

        return true; // is all
      }),
    [
      sortMessages,
      unreads,
      chats,
      groups,
      pinned,
      searchQuery,
      allPending,
      filter,
      contacts,
      clubs,
    ]
  );

  const headerHeightRef = useRef<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);
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
        isMobile && !hasPending ? (
          <InlineEmptyPlaceholder className="mt-24">
            Your direct messages will be shown here
          </InlineEmptyPlaceholder>
        ) : null,
    }),
    [head, isMobile, hasPending]
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
      ref={virtuosoRef}
      data={organizedUnreads}
      computeItemKey={computeItemKey}
      itemContent={itemContent}
      components={components}
      atTopStateChange={atTopChange}
      isScrolling={isScrolling}
      restoreStateFrom={virtuosoState}
      className="w-full overflow-x-hidden"
      data-testid="messages-menu"
    />
  );
}
