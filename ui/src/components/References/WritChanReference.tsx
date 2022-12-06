import React from 'react';
import { Link } from 'react-router-dom';
import { useWritByFlagAndWritId } from '@/state/chat';
import { useChannelPreview } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';

export default function WritChanReference(props: {
  chFlag: string;
  nest: string;
  idWrit: string;
  isScrolling: boolean;
}) {
  const { chFlag, nest, idWrit, isScrolling } = props;
  const writ = useWritByFlagAndWritId(chFlag, idWrit, isScrolling);
  return <WritBaseReference writ={writ} {...props} />;
}
