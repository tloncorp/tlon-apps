import useMessageSort from '@/logic/useMessageSort';
import { useGroups, useVessel } from '@/state/groups';
import { filters, SidebarFilter } from '@/state/settings';
import cn from 'classnames';
import React from 'react';
import { RECENT } from '../logic/useSidebarSort';
import { canReadChannel, whomIsDm, whomIsMultiDm } from '../logic/utils';
import {
  usePendingDms,
  useBriefs,
  isGroupBrief,
  usePendingMultiDms,
  usePinned,
  useChats,
} from '../state/chat';
import MessagesSidebarItem from './MessagesSidebarItem';

interface MessagesListProps {
  filter: SidebarFilter;
}

export default function MessagesList({ filter }: MessagesListProps) {
  const pending = usePendingDms();
  const pendingMultis = usePendingMultiDms();
  const pinned = usePinned();
  const { sortOptions } = useMessageSort();
  const briefs = useBriefs();
  const chats = useChats();
  const groups = useGroups();

  const allPending = pending.concat(pendingMultis);

  const organizedBriefs = Object.keys(briefs)
    .filter((b) => {
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
    })
    .sort(sortOptions[RECENT])
    .reverse();

  return (
    <ul
      className={cn(
        'flex w-full flex-col space-y-3 overflow-x-hidden overflow-y-scroll px-2 pr-0 sm:space-y-1'
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
