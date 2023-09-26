import React, { PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useMessageSort from '@/logic/useMessageSort';
import { filters, SidebarFilter } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { DMBrief } from '@/types/dms';
import { useBriefs, useChats } from '@/state/channel/channel';
import { useGroups } from '@/state/groups';
import { canReadChannel } from '@/logic/channel';
import {
  usePendingDms,
  isGroupBrief,
  usePendingMultiDms,
  usePinned,
  useDmBriefs,
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

type MessagesListProps = PropsWithChildren<{
  filter: SidebarFilter;
  atTopChange?: (atTop: boolean) => void;
  isScrolling?: (scrolling: boolean) => void;
}>;

function itemContent(_i: number, [whom, _brief]: [string, DMBrief]) {
  return (
    <div className="px-4 sm:px-2">
      <MessagesSidebarItem key={whom} whom={whom} />
    </div>
  );
}

const computeItemKey = (_i: number, [whom, _brief]: [string, DMBrief]) => whom;

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
  const { data: dmBriefs } = useDmBriefs();
  const channelBriefs = useBriefs();
  const briefs = useMemo(
    () => ({
      ...channelBriefs,
      ...dmBriefs,
    }),
    [channelBriefs, dmBriefs]
  );
  const chats = useChats();
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

  const organizedBriefs = useMemo(
    () =>
      sortMessages(briefs).filter(([b]) => {
        const chat = chats[b];
        const groupFlag = chat?.perms.group;
        const group = groups[groupFlag || ''];
        const vessel = group?.fleet[window.our];
        const channel = group?.channels[b];

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

        if (filter === filters.dms && isGroupBrief(b)) {
          return false;
        }

        if (isGroupBrief(b) && !group) {
          return false;
        }

        return true; // is all
      }),
    [allPending, briefs, filter, pinned, sortMessages, chats, groups]
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
    }),
    [head]
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
      data={organizedBriefs}
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
