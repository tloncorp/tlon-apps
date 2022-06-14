import cn from 'classnames';
import React from 'react';
import useSidebarSort, { RECENT } from '../logic/useSidebarSort';
import {
  usePendingDms,
  useBriefs,
  isDMBrief,
  isGroupBrief,
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

export type SidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Talk Channels';

export const filters: Record<string, SidebarFilter> = {
  dms: 'Direct Messages',
  all: 'All Messages',
  groups: 'Group Talk Channels',
};

interface MessagesListProps {
  filter: SidebarFilter;
}

export default function MessagesList({ filter }: MessagesListProps) {
  const pending = usePendingDms();
  const { sortOptions } = useSidebarSort(RECENT);
  const briefs = useBriefs();

  const organizedBriefs = Object.keys(briefs)
    .filter((b) => {
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
    <ul className={cn('flex w-full flex-col p-2')}>
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
