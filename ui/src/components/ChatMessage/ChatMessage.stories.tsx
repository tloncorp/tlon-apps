import { unixToDa } from '@urbit/api';
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
const time = unixToDa(writ.memo.sent);

export function Text() {
  return (
    <ChatMessage time={time} whom="~zod/test" writ={writ} newAuthor newDay />
  );
}
