import React, { PropsWithChildren, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import useMessageSort from '@/logic/useMessageSort';
import { filters, SidebarFilter } from '@/state/settings';
import { useIsMobile } from '@/logic/useMedia';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { DMBrief } from '@/types/dms';
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
  const { data: briefs } = useDmBriefs();
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
    [allPending, briefs, filter, pinned, sortMessages]
  );

  const head = useMemo(
    () => (
      <>
        {children}
        {allPending &&
          filter !== filters.groups &&
          allPending.map((whom) => (
            <div key={whom} className="px-4 sm:px-2">
              <MessagesSidebarItem pending key={whom} whom={whom} />
            </div>
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
