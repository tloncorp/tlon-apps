import { makeChatWrit } from '../fixtures/chat';
import { ChatWrit } from '../types/chat';

const chatWrits: ChatWrit[] = [
  makeChatWrit(1, '~hastuc-dibtux', {
    kind: 'text',
    contentText: 'A test message',
  }),
  makeChatWrit(2, '~finned-palmer', {
    kind: 'text',
    contentText: 'A finned test message',
  }),
  makeChatWrit(3, '~hastuc-dibtux', {
    kind: 'text',
    contentText: 'A test message',
  }),
  makeChatWrit(4, '~hastuc-dibtux', {
    kind: 'text',
    contentText: 'A test message',
  }),
  makeChatWrit(5, '~hastuc-dibtux', {
    kind: 'text',
    contentText: 'A test message',
  }),
];

export default chatWrits;
