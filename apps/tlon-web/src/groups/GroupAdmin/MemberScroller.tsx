import React, { ForwardedRef, forwardRef } from 'react';
import { Virtuoso, Components as VirtuosoComponents } from 'react-virtuoso';

import { useIsMobile } from '@/logic/useMedia';

import GroupMemberItem from './GroupMemberItem';

interface MemberScrollerProps {
  members: string[];
}

const Components: VirtuosoComponents<string> = {
  List: forwardRef((props, listRef) => (
    <ul
      className="h-full w-full"
      {...props}
      ref={listRef as ForwardedRef<HTMLUListElement>}
    >
      {props.children}
    </ul>
  )),
  Item: forwardRef((props, itemRef) => (
    <li
      className="group flex items-center justify-between rounded-lg px-2 py-3 hover:bg-gray-50"
      {...props}
      // @ts-expect-error tsc complains about the ref prop, but it's fine
      ref={itemRef}
    >
      {props.children}
    </li>
  )),
};

export default function MemberScroller({ members }: MemberScrollerProps) {
  const isMobile = useIsMobile();

  const thresholds = {
    atBottomThreshold: 125,
    atTopThreshold: 125,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  if (members.length === 0) {
    return <p>No members</p>;
  }

  return (
    <Virtuoso
      {...thresholds}
      data={members}
      computeItemKey={(i, member: string) => member}
      itemContent={(i, member: string) => <GroupMemberItem member={member} />}
      style={{
        minHeight: '100%',
      }}
      components={Components}
    />
  );
}
