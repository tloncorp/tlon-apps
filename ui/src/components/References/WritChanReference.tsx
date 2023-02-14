import React from 'react';
import { useWritByFlagAndWritId } from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';

export default function WritChanReference(props: {
  chFlag: string;
  nest: string;
  idWrit: string;
  isScrolling: boolean;
}) {
  const { chFlag, idWrit, isScrolling } = props;
  const writ = useWritByFlagAndWritId(chFlag, idWrit, isScrolling);
  return <WritBaseReference writ={writ} {...props} />;
}
