import { makeChatWrit } from '../fixtures/chat';
import { ChatWrit } from '../types/chat';

const chatWrits: ChatWrit[] = [
  makeChatWrit(1, '~hastuc-dibtux', {
    block: [],
    inline: [{ bold: 'A bold test message' }, "with some more text"],
  }),
  makeChatWrit(2, '~finned-palmer', {
    block: [],
    inline: ['A finned normal message'],
  }),
  makeChatWrit(
    3,
    '~hastuc-dibtux',
    {
      block: [],
      inline: [{italics: 'An italicized test message'}, "with a link:", {href: "https://urbit.org"}],
    },
    { HAHA: '😆' }
  ),
  makeChatWrit(4, '~hastuc-dibtux', {
    block: [],
    inline: [{href:'https://tlon.io/'}],
  }),
];

export default chatWrits;

export const chatKeys = ['~zod/test'];

export const chatPerm = {
  writers: [],
}
