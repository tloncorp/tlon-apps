import React from 'react';
import { useRemoteNote } from '@/state/channel/channel';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';

function WritChanReference(props: {
  nest: string;
  idWrit: string;
  idQuip?: string;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const { nest, idWrit, idQuip, isScrolling, contextApp, children } = props;
  const reference = useRemoteNote(nest, idWrit, isScrolling, idQuip);
  return (
    <WritBaseReference reference={reference} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}

export default React.memo(WritChanReference);
