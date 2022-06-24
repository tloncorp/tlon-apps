import cn from 'classnames';
import React from 'react';
import useSidebarSort, { RECENT } from '../logic/useSidebarSort';
import { whomIsDm } from '../logic/utils';
import {
  usePendingDms,
  useBriefs,
  isGroupBrief,
  usePinnedChats,
  usePendingMultiDms,
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';
import { filters, SidebarFilter } from './useMessagesFilter';

interface MessagesListProps {
  filter: SidebarFilter;
}

export default function MessagesList({ filter }: MessagesListProps) {
  const pending = usePendingDms();
  const pendingMultis = usePendingMultiDms();
  const pinned = usePinnedChats();
  const { sortOptions } = useSidebarSort(RECENT);
  const briefs = useBriefs();

  const allPending = pending.concat(pendingMultis);

  const organizedBriefs = Object.keys(briefs)
    .filter((b) => {
      if (pinned.includes(b)) {
        return false;
      }

      if (allPending.includes(b)) {
        return false;
      }

      if (filter === filters.groups && whomIsDm(b)) {
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
        'flex w-full flex-col space-y-3 overflow-x-hidden overflow-y-scroll px-2 pr-0 sm:space-y-0'
      )}
    >
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
      {organizedBriefs.map((ship) => (
        <MessagesSidebarItem key={ship} whom={ship} brief={briefs[ship]} />
      ))}
    </ul>
  );
}
