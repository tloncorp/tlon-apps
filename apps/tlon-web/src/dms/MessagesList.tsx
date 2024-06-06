import { stripSourcePrefix } from '@tloncorp/shared/src/urbit/activity';
import fuzzy from 'fuzzy';
import React, { PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { InlineEmptyPlaceholder } from '@/components/EmptyPlaceholder';
import { canReadChannel } from '@/logic/channel';
import { useIsMobile } from '@/logic/useMedia';
import useMessageSort from '@/logic/useMessageSort';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import {
  Cohort,
  Cohorts,
  cohortToUnread,
  useCohorts,
} from '@/state/broadcasts';
import { useChats } from '@/state/channel/channel';
import { useContacts } from '@/state/contact';
import { useGroups } from '@/state/groups';
import { usePinnedChats } from '@/state/pins';
import { SidebarFilter, filters } from '@/state/settings';
import { Unread, useUnreads } from '@/state/unreads';

import { useMultiDms, usePendingDms, usePendingMultiDms } from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

type MessagesListProps = PropsWithChildren<{
  filter: SidebarFilter;
  searchQuery?: string;
  atTopChange?: (atTop: boolean) => void;
  isScrolling?: (scrolling: boolean) => void;
}>;

function itemContent(_i: number, [whom, _unread]: [string, Unread]) {
  return (
    <div className="px-4 sm:px-2">
      <MessagesSidebarItem key={whom} whom={whom} />
    </div>
  );
}

const computeItemKey = (_i: number, [whom, _unread]: [string, Unread]) => whom;

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
  const broadcasts = useCohorts();
  const unreads = useUnreads();
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

  console.log('filter', filter, filters.broadcasts, broadcasts.data);
  const organizedUnreads = useMemo(() => {
    const filteredMsgs = sortMessages(
        filter === filters.broadcasts
          ? Object.fromEntries(
              Object.entries(broadcasts.data || {}).map(
                (v): [string, Unread] => {
                  return [v[0], cohortToUnread(v[1] as Cohort)]; //REVIEW hax
                }
              )
            )
          : unreads
      ).filter(([k]) => {
        if (k.startsWith('~~') && filter === filters.broadcasts) {
          return true;
        }

        if (
          !(
            k.startsWith('ship/') ||
            k.startsWith('club/') ||
            k.startsWith('channel/')
          )
        ) {
          return false;
        }

        const key = stripSourcePrefix(k);
        const chat = chats[key];
        const groupFlag = chat?.perms.group;
        const group = groups[groupFlag || ''];
        const vessel = group?.fleet[window.our];
        const channel = group?.channels[key];
        const isChannel = k.startsWith('channel/');
        const isDm = k.startsWith('ship/');
        const isMultiDm = k.startsWith('club/');

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

        return true; // is all
      })
      .map(([k, v]) => [stripSourcePrefix(k), v]) as [string, Unread][];
    return !searchQuery
      ? filteredMsgs
      : fuzzy
          .filter(searchQuery, filteredMsgs, { extract: (x) => x[0] })
          .sort((a, b) => b.score - a.score)
          .map((x) => x.original);
  }, [sortMessages, unreads, chats, groups, pinned, searchQuery, allPending, filter, broadcasts]);

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
