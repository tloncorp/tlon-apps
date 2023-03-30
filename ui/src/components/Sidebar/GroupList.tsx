import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
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

  const head = useMemo(() => <div>{children}</div>, [children]);

  const components = useMemo(
    () => ({
      Header: () => head,
    }),
    [head]
  );

  if (!groups) {
    return <GroupListPlaceholder count={5} />;
  }

  return (
    <Virtuoso
      {...thresholds}
      data={groupsWithoutPinned}
      computeItemKey={(_i, [flag]) => flag}
      itemContent={itemContent}
      components={components}
      className="h-full w-full list-none overflow-x-hidden"
      isScrolling={isScrolling}
      atTopStateChange={atTopChange}
    />
  );
}
