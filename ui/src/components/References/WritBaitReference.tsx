import React from 'react';
import { Link } from 'react-router-dom';
import {
  useWritByFlagAndGraphIndex,
  useWritByFlagAndWritId,
} from '@/state/chat';
import { useChannelPreview } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';

export default function WritBaitReference(props: {
  chFlag: string;
  nest: string;
  index: string;
  isScrolling: boolean;
}) {
  const { chFlag, nest, index, isScrolling } = props;
  const writ = useWritByFlagAndGraphIndex(chFlag, index, isScrolling);
  return <WritBaseReference writ={writ || undefined} {...props} />;
}
