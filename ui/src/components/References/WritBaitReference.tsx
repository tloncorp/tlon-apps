import React from 'react';
import { Link } from 'react-router-dom';
import {
  useWritByFlagAndGraphIndex,
  useWritByFlagAndWritId,
} from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';
import UnavailableReference from './UnavailableReference';
import { makePatDa, udToDec } from '@urbit/api';
import bigInt from 'big-integer';

export default function WritBaitReference(props: {
  chFlag: string;
  nest: string;
  index: string;
  isScrolling: boolean;
}) {
  const { chFlag, nest, index, isScrolling } = props;
  const writ = useWritByFlagAndGraphIndex(chFlag, index, isScrolling);
  const [, udId] = index.split('/');
  if (writ === 'loading') {
    const time = bigInt(udToDec(udId));
    return <UnavailableReference time={time} nest={nest} preview={null} />;
  }
  return (
    <WritBaseReference writ={writ === 'error' ? undefined : writ} {...props} />
  );
}
