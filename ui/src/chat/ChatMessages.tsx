import React from 'react';
import { useMessagesForChat } from '../state/chat';
import { useChat } from './useChatStore';

import VirtuosoScroller from '../components/ChatScroller/VirtuosoScroller';
import Groups1Scroller from '../components/ChatScroller/Groups1Scroller';
import { ChatMessageProps } from './ChatMessage/ChatMessage';

const GROUPS_SCROLLER = 'GROUPS1';
const VIRTUOSO_SCROLLER = 'VIRTUOSO';

export interface ChatMessagesProps
  extends Omit<ChatMessageProps, 'writ' | 'newAuthor' | 'newDay'> {
  flag: string;
  replying?: string;
}

export default function ChatMessages(props: ChatMessagesProps) {
  const { flag, replying = null } = props;
  const messages = useMessagesForChat(flag);
  const chat = useChat(flag);

  const SCROLLER =
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.scroller === 'virtuoso' ? VIRTUOSO_SCROLLER : GROUPS_SCROLLER;

  return SCROLLER === VIRTUOSO_SCROLLER ?
    <VirtuosoScroller chat={chat} messages={messages} replying={replying} /> :
    SCROLLER === GROUPS_SCROLLER ?
      <Groups1Scroller chat={chat} messages={messages} replying={replying} /> :
      null;
}
