import cn from 'classnames';
import React from 'react';
import useSidebarSort, { RECENT } from '../logic/useSidebarSort';
import {
  usePendingDms,
  useBriefs,
  isDMBrief,
  isGroupBrief,
  usePinnedChats,
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';
import { filters, SidebarFilter } from './useMessagesFilter';

interface MessagesListProps {
  filter: SidebarFilter;
}

export default function MessagesList({ filter }: MessagesListProps) {
  const pending = usePendingDms();
  const pinned = usePinnedChats();
  const { sortOptions } = useSidebarSort(RECENT);
  const briefs = useBriefs();

  const organizedBriefs = Object.keys(briefs)
    .filter((b) => {
      if (pinned.includes(b)) {
        return false;
      }

      if (pending.includes(b)) {
        return false;
      }

      if (filter === filters.groups && isDMBrief(b)) {
        return false;
      }

      if (filter === filters.dms && isGroupBrief(b)) {
        return false;
      }

      return true; // is all
    })
    .sort(sortOptions[RECENT]);

  return (
    <ul
      className={cn(
        'flex w-full flex-col space-y-3 overflow-y-scroll p-2 pr-0 sm:space-y-0'
      )}
    >
      {pending &&
        filter !== filters.groups &&
        pending.map((ship) => (
          <MessagesSidebarItem
            pending
            key={ship}
            whom={ship}
            brief={briefs[ship]}
          />
        ))}
      {organizedBriefs.map((ship) => (
        <MessagesSidebarItem key={ship} whom={ship} brief={briefs[ship]} />
      ))}
    </ul>
  );
}
