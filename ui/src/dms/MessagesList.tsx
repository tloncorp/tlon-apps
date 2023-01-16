import React, { PropsWithChildren, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import useMessageSort from '@/logic/useMessageSort';
import { useGroups } from '@/state/groups';
import { filters, SidebarFilter } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import { canReadChannel, whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { ChatBrief } from '@/types/chat';
import {
  usePendingDms,
  useBriefs,
  isGroupBrief,
  usePendingMultiDms,
  usePinned,
  useChats,
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

type MessagesListProps = PropsWithChildren<{
  filter: SidebarFilter;
  atTopChange?: (atTop: boolean) => void;
  isScrolling?: (scrolling: boolean) => void;
}>;

function itemContent(_i: number, [whom, _brief]: [string, ChatBrief]) {
  return (
    <div className="pl-2 pb-3 sm:pb-1">
      <MessagesSidebarItem key={whom} whom={whom} />
    </div>
  );
}

const computeItemKey = (_i: number, [whom, _brief]: [string, ChatBrief]) =>
  whom;

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
  const briefs = useBriefs();
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
        const channel = group?.channels[`chat/${b}`];

        if (
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

        return true; // is all
      }),
    [allPending, briefs, chats, filter, groups, pinned, sortMessages]
  );

  const head = useMemo(
    () => (
      <>
        {children}
        {allPending &&
          filter !== filters.groups &&
          allPending.map((whom) => (
            <MessagesSidebarItem pending key={whom} whom={whom} />
          ))}
      </>
    ),
    [children, allPending, filter]
  );

  const components = useMemo(
    () => ({
      Header: () => head,
    }),
    [head]
  );

  return (
    <Virtuoso
      {...thresholds}
      data={organizedBriefs}
      computeItemKey={computeItemKey}
      itemContent={itemContent}
      components={components}
      atTopStateChange={atTopChange}
      isScrolling={isScrolling}
      className="w-full overflow-x-hidden"
    />
  );
}
