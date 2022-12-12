import React, { PropsWithChildren, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import useMessageSort from '@/logic/useMessageSort';
import { useGroups } from '@/state/groups';
import { filters, SidebarFilter } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import { canReadChannel, whomIsDm, whomIsMultiDm } from '@/logic/utils';
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

  const organizedBriefs = sortMessages(briefs).filter(([b]) => {
    const chat = chats[b];
    const groupFlag = chat?.perms.group;
    const group = groups[groupFlag || ''];
    const vessel = group?.fleet[window.our];
    const channel = group?.channels[`chat/${b}`];

    if (channel && vessel && !canReadChannel(channel, vessel)) {
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
  });

  const head = useMemo(
    () => (
      <>
        {children}
        {allPending &&
          filter !== filters.groups &&
          allPending.map((whom) => (
            <MessagesSidebarItem
              pending
              key={whom}
              whom={whom}
              brief={briefs[whom]}
            />
          ))}
      </>
    ),
    [children, allPending, briefs, filter]
  );

  return (
    <Virtuoso
      {...thresholds}
      data={organizedBriefs}
      computeItemKey={(i, [whom]) => whom}
      itemContent={(i, [whom, brief]) => (
        <div className="pl-2 pb-3 sm:pb-1">
          <MessagesSidebarItem key={whom} whom={whom} brief={brief} />
        </div>
      )}
      components={{
        Header: () => head,
      }}
      atTopStateChange={atTopChange}
      isScrolling={isScrolling}
      className="w-full overflow-x-hidden"
      style={{
        overflowY: 'scroll',
      }}
    />
  );
}
