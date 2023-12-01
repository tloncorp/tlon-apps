import React from 'react';
import bigInt from 'big-integer';
import { useRemotePost } from '@/state/channel/channel';
// eslint-disable-next-line import/no-cycle
import WritBaseReference from './WritBaseReference';
// eslint-disable-next-line import/no-cycle
import UnavailableReference from './UnavailableReference';

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

  if (isError) {
    return <UnavailableReference time={bigInt(0)} nest={nest} preview={null} />;
  }

  return (
    <WritBaseReference reference={reference} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}

export default React.memo(WritChanReference);
