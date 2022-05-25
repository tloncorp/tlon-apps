import React from 'react';
import { BigIntOrderedMap } from '@urbit/api';

import { ChatWrit } from '../types/chat';
import ChatScroller from './ChatScroller/ChatScroller';

interface ChatMessagesProps {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
  replying?: boolean;
}

export default function ChatMessages(props: ChatMessagesProps) {
  const { messages, whom, replying = false } = props;

  return <ChatScroller {...{ whom, messages, replying }} />;
}
