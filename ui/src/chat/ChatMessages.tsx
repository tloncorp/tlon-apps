import React, { useEffect } from 'react';
import { BigIntOrderedMap } from '@urbit/api';

import { ChatMessageProps } from './ChatMessage/ChatMessage';
import { ChatWrit } from '../types/chat';
import VirtuosoScroller from './ChatScroller/VirtuosoScroller';
import Groups1Scroller from './ChatScroller/Groups1Scroller';

interface ChatMessagesProps
  extends Omit<
    ChatMessageProps,
    'writ' | 'newAuthor' | 'newDay' | 'time' | 'whom'
  > {
  whom: string;

  messages: BigIntOrderedMap<ChatWrit>;
  replying?: boolean;
}

export default function ChatMessages(props: ChatMessagesProps) {
  const { messages, replying = false, whom } = props;

  const Scroller =
    window.scroller === 'virtuoso' ? VirtuosoScroller : Groups1Scroller;

  return <Scroller {...{ whom, messages, replying }} />;
}
