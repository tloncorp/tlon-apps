import React from 'react';
import { BigIntOrderedMap } from '@urbit/api';

import { ChatWrit } from '../types/chat';
import VirtuosoScroller from './ChatScroller/VirtuosoScroller';
import Groups1Scroller from './ChatScroller/Groups1Scroller';

interface ChatMessagesProps {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
  replying?: boolean;
}

export default function ChatMessages(props: ChatMessagesProps) {
  const { messages, whom, replying = false } = props;

  const Scroller =
    window.scroller === 'virtuoso' ? VirtuosoScroller : Groups1Scroller;

  return <Scroller {...{ whom, messages, replying }} />;
}
