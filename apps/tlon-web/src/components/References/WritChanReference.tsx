import bigInt from 'big-integer';
import React from 'react';

import { useRemotePost } from '@/state/channel/channel';

import UnavailableReference from './UnavailableReference';
import WritBaseReference from './WritBaseReference';

function WritChanReference(props: {
  nest: string;
  idWrit: string;
  idReply?: string;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const { nest, idWrit, idReply, isScrolling, contextApp, children } = props;
  const { reference, isError } = useRemotePost(
    nest,
    idWrit,
    isScrolling,
    idReply
  );

  if (isError || reference === null) {
    return <UnavailableReference time={bigInt(0)} nest={nest} preview={null} />;
  }

  return (
    <WritBaseReference reference={reference} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}

export default React.memo(WritChanReference);
