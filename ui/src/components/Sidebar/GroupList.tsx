import React, { ReactNode, useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useIsMobile } from '@/logic/useMedia';
import { Group } from '@/types/groups';
import GroupListPlaceholder from './GroupListPlaceholder';
import GroupsSidebarItem from './GroupsSidebarItem';

type TopContentListItem = { type: 'top'; component: ReactNode };
type GroupListItem = { type: 'group'; data: [string, Group] };
type AnyListItem = TopContentListItem | GroupListItem;

function itemContent(_i: number, item: AnyListItem) {
  if (item.type === 'top') {
    return item.component;
  }
  const [flag] = item.data;
  return (
    <div className="px-4 sm:px-2">
      <GroupsSidebarItem key={flag} flag={flag} />
    </div>
  );
}

function computeItemKey(_i: number, item: AnyListItem) {
  if (item.type === 'top') {
    return 'top';
  }
  const [flag] = item.data;
  return flag;
}

interface GroupListProps {
  groups: [string, Group][];
  pinnedGroups: [string, Group][];
  loadingGroups: [string, Group][];
  children: React.ReactNode;
  isScrolling: (scrolling: boolean) => void;
  atTopChange?: (atTop: boolean) => void;
}

let virtuosoState: StateSnapshot | undefined;

export default function GroupList({
  groups,
  pinnedGroups,
  loadingGroups,
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

  const pinnedOrLoading = useMemo(() => {
    const flags = new Set();
    pinnedGroups.forEach(([flag]) => flags.add(flag));
    loadingGroups.forEach(([flag]) => flags.add(flag));
    return flags;
  }, [pinnedGroups, loadingGroups]);

  const allOtherGroups = useMemo(
    () => groups.filter(([flag, _g]) => !pinnedOrLoading.has(flag)),
    [groups, pinnedOrLoading]
  );

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
      ...allOtherGroups.map<GroupListItem>((g) => ({
        type: 'group',
        data: g,
      })),
    ];
  }, [allOtherGroups, header]);

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
      className="h-full w-full list-none overflow-x-hidden"
      isScrolling={isScrolling}
      atTopStateChange={atTopChange}
    />
  );
}
