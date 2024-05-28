import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import React from 'react';

import { useRemotePost } from '@/state/channel/channel';

import UnavailableReference from './UnavailableReference';
// import { useWritByFlagAndGraphIndex } from '@/state/chat';
import WritBaseReference from './WritBaseReference';

export default function WritBaitReference(props: {
  chFlag: string;
  nest: string;
  index: string;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const { chFlag, nest, index, isScrolling, contextApp, children } = props;
  const { reference } = useRemotePost(nest, index, isScrolling);
  const [, udId] = index.split('/');
  if (!reference) {
    const time = bigInt(udToDec(udId));
    return <UnavailableReference time={time} nest={nest} preview={null} />;
  }
  return (
    <WritBaseReference reference={reference} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}
