import React from 'react';
import { useMessagesForChat } from '../state/chat';
import { useChat } from './useChatStore';

import VirtuosoScroller from './ChatScroller/VirtuosoScroller';
import Groups1Scroller from './ChatScroller/Groups1Scroller';
import { ChatMessageProps } from './ChatMessage/ChatMessage';

export interface ChatMessagesProps
  extends Omit<ChatMessageProps, 'writ' | 'newAuthor' | 'newDay'> {
  flag: string;
  replying?: string;
}

export default function ChatMessages(props: ChatMessagesProps) {
  const { flag, replying = null } = props;
  const messages = useMessagesForChat(flag);
  const chat = useChat(flag);

  const Scroller =
    window.scroller === 'virtuoso' ? VirtuosoScroller : Groups1Scroller;

  return <Scroller {...{ chat, messages, replying }} />;
}
