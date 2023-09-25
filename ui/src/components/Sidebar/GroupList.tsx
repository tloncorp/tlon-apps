import React, { useEffect, useMemo, useRef } from 'react';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useIsMobile } from '@/logic/useMedia';
import { Group } from '@/types/groups';
import GroupListPlaceholder from './GroupListPlaceholder';
import GroupsSidebarItem from './GroupsSidebarItem';

function itemContent(_i: number, [flag, _group]: [string, Group]) {
  return (
    <div className="px-4 sm:px-2">
      <GroupsSidebarItem key={flag} flag={flag} />
    </div>
  );
}

interface GroupListProps {
  groups: [string, Group][];
  pinnedGroups: [string, Group][];
  children: React.ReactNode;
  isScrolling: (scrolling: boolean) => void;
  atTopChange?: (atTop: boolean) => void;
}

let virtuosoState: StateSnapshot | undefined;

export default function GroupList({
  groups,
  pinnedGroups,
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

  const groupsWithoutPinned = useMemo(
    () =>
      groups.filter(
        ([flag, _g]) => !pinnedGroups.map(([f, _]) => f).includes(flag)
      ),
    [groups, pinnedGroups]
  );

  const headerHeightRef = useRef<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const head = useMemo(
    () => <div ref={headerRef}>{children}</div>,
    [headerRef, children]
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

  if (!groups) {
    return <GroupListPlaceholder count={5} />;
  }

  return (
    <Virtuoso
      {...thresholds}
      ref={virtuosoRef}
      data={groupsWithoutPinned}
      computeItemKey={(_i, [flag]) => flag}
      itemContent={itemContent}
      components={components}
      restoreStateFrom={virtuosoState}
      className="h-full w-full list-none overflow-x-hidden"
      isScrolling={isScrolling}
      atTopStateChange={atTopChange}
    />
  );
}
