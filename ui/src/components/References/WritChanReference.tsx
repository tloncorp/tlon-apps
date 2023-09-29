import React from 'react';
import { useRemotePost } from '@/state/channel/channel';
// eslint-disable-next-line import/no-cycle
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
  const reference = useRemotePost(nest, idWrit, isScrolling, idReply);
  return (
    <WritBaseReference reference={reference} contextApp={contextApp} {...props}>
      {children}
    </WritBaseReference>
  );
}

export default React.memo(WritChanReference);
