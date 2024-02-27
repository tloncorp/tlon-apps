import React, { forwardRef } from 'react';
import { Virtuoso, Components as VirtuosoComponents } from 'react-virtuoso';

import { useIsMobile } from '@/logic/useMedia';

import PendingMemberItem from './PendingMemberItem';

interface PendingScrollerProps {
  members: string[];
}

const Components: VirtuosoComponents<string> = {
  List: forwardRef((props, listRef) => (
    <div className="h-full w-full" {...props} ref={listRef}>
      {props.children}
    </div>
  )),
  Item: forwardRef((props, itemRef) => (
    <div
      className="flex items-center border-t border-gray-100 py-3 font-semibold hover:bg-gray-50"
      {...props}
      // @ts-expect-error tsc complains about the ref prop, but it's fine
      ref={itemRef}
    >
      {props.children}
    </div>
  )),
};

export default function PendingScroller({ members }: PendingScrollerProps) {
  const isMobile = useIsMobile();

  const thresholds = {
    atBottomThreshold: 125,
    atTopThreshold: 125,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  if (members.length === 0) {
    return <p>No pending</p>;
  }

  return (
    <Virtuoso
      {...thresholds}
      data={members}
      computeItemKey={(i, member: string) => member}
      itemContent={(i, member: string) => <PendingMemberItem member={member} />}
      style={{
        minHeight: '100%',
      }}
      components={Components}
    />
  );
}
