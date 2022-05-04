import React from 'react';
import { makeChatWrit } from '../../fixtures/chat';
import ChatMessage from './ChatMessage';

export default {
  component: 'ChatMessage',
  title: 'ChatMessage',
};

const writ = makeChatWrit(1, '~finned-palmer', {
  block: [],
  inline: [{ bold: 'A bold test message' }, 'with some more text'],
});

export function Text() {
  return <ChatMessage writ={writ} newAuthor newDay />;
}
