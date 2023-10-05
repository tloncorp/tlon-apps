import React from 'react';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useRemotePost } from '@/state/channel/channel';
// import { useWritByFlagAndGraphIndex } from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';
import UnavailableReference from './UnavailableReference';

export default function WritBaitReference(props: {
  chFlag: string;
  nest: string;
  index: string;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const { chFlag, nest, index, isScrolling, contextApp, children } = props;
  const note = useRemotePost(chFlag, index, isScrolling);
  const [, udId] = index.split('/');
  if (note === undefined) {
    const time = bigInt(udToDec(udId));
    return <UnavailableReference time={time} nest={nest} preview={null} />;
  }
  return (
    <WritBaseReference reference={note} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}
