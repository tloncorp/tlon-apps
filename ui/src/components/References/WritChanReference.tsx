import React from 'react';
import { useWritByFlagAndWritId } from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';

function WritChanReference(props: {
  chFlag: string;
  nest: string;
  idWrit: string;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const { chFlag, idWrit, isScrolling, contextApp, children } = props;
  const writ = useWritByFlagAndWritId(chFlag, idWrit, isScrolling);
  return (
    <WritBaseReference writ={writ} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}

export default React.memo(WritChanReference);
