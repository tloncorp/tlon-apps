import { Group } from '@tloncorp/shared/dist/urbit/groups';
import React, { ReactNode, useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { useIsMobile } from '@/logic/useMedia';

import GangItem from './GangItem';
import GroupListPlaceholder from './GroupListPlaceholder';
import GroupsSidebarItem from './GroupsSidebarItem';
import { GroupSearchRecord, isGroupSearchRecord } from './useSearchFilter';

type TopContentListItem = { type: 'top'; component: ReactNode };
type GroupListItem = { type: 'group'; data: [string, Group] };
type SearchListItem = { type: 'search'; data: GroupSearchRecord };
type AnyListItem = TopContentListItem | GroupListItem | SearchListItem;

function itemContent(_i: number, item: AnyListItem) {
  if (item.type === 'top') {
    return <div className="min-h-[1px]">{item.component}</div>;
  }

  if (item.type === 'search') {
    const record = item.data;
    if (record.type === 'group') {
      return (
        <div className="min-h-[1px] px-4 sm:px-2">
          <GroupsSidebarItem
            flag={record.flag}
            isNew={record.status === 'new'}
          />
        </div>
      );
    }

    return (
      <div className="min-h-[1px] px-4 sm:px-2">
        <GangItem
          flag={record.flag}
          invited={record.status === 'invited'}
          isJoining={record.status === 'loading'}
        />
      </div>
    );
  }

  const [flag] = item.data;
  return (
    <div className="min-h-[1px] px-4 sm:px-2">
      <GroupsSidebarItem key={flag} flag={flag} />
    </div>
  );
}

function computeItemKey(_i: number, item: AnyListItem) {
  if (item.type === 'top') {
    return 'top';
  }

  if (item.type === 'search') {
    return `search:${item.data.flag}`;
  }

  const [flag] = item.data;
  return flag;
}

interface GroupListProps {
  groups: [string, Group][] | GroupSearchRecord[];
  children: React.ReactNode;
  isScrolling: (scrolling: boolean) => void;
  atTopChange?: (atTop: boolean) => void;
}

let virtuosoState: StateSnapshot | undefined;

export default function GroupList({
  groups,
  children,
  isScrolling,
  atTopChange,
}: GroupListProps) {
  const isMobile = useIsMobile();
  const thresholds = {
    atBottomThreshold: 125,
    atTopThreshold: 125,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const headerHeightRef = useRef<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const header = useMemo(
    // Re: min-h below: if virtuoso ever encounters a 0-height element, its
    // whole render will fail. This min height ensures that no matter what's
    // passed, it'll have at least 1px of height.
    () =>
      children ? (
        <div className="min-h-[1px]" ref={headerRef}>
          {children}
        </div>
      ) : null,
    [children]
  );

  const listItems: AnyListItem[] = useMemo(() => {
    const top: TopContentListItem[] = header
      ? [{ type: 'top', component: header }]
      : [];
    return [
      ...top,
      ...groups.map<GroupListItem | SearchListItem>((g) =>
        isGroupSearchRecord(g)
          ? { type: 'search', data: g }
          : {
              type: 'group',
              data: g,
            }
      ),
    ];
  }, [groups, header]);

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

  if (!groups) {
    return <GroupListPlaceholder count={5} />;
  }

  return (
    <Virtuoso
      {...thresholds}
      ref={virtuosoRef}
      data={listItems}
      computeItemKey={computeItemKey}
      itemContent={itemContent}
      restoreStateFrom={virtuosoState}
      className="border-top-none h-full w-full list-none overflow-x-hidden"
      isScrolling={isScrolling}
      atTopStateChange={atTopChange}
    />
  );
}
