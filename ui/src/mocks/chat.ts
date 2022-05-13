import { subDays, subMinutes } from 'date-fns';
import { decToUd, unixToDa } from '@urbit/api';
import { ChatWrit, ChatMessage } from '../types/chat';

const today = new Date();

export const makeChatWrit = (
  count: number,
  author: string,
  content: ChatMessage,
  feels?: Record<string, string>,
  setTime?: Date
): ChatWrit => {
  const unix = subMinutes(setTime ? setTime : new Date(), count * 5).getTime();
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      time: da,
      feels: feels ?? {},
      replied: [],
    },
    memo: {
      replying: null,
      author,
      sent: unix,
      content,
    },
  };
};

const chatWrits: ChatWrit[] = [
  makeChatWrit(
    1,
    '~hastuc-dibtux',
    {
      block: [],
      inline: [{ bold: 'A bold test message' }, ' with some more text'],
    },
    undefined,
    today
  ),
  makeChatWrit(
    2,
    '~finned-palmer',
    {
      block: [],
      inline: ['A finned normal message on the same day'],
    },
    undefined,
    subDays(today, 1)
  ),
  makeChatWrit(
    3,
    '~finned-palmer',
    {
      block: [],
      inline: ['A finned normal message'],
    },
    undefined,
    subDays(today, 1)
  ),
  makeChatWrit(
    4,
    '~hastuc-dibtux',
    {
      block: [],
      inline: [
        { italics: 'An italicized test message' },
        ' with a link:',
        { link: { href: 'https://urbit.org', content: '' } },
      ],
    },
    { HAHA: '😆' },
    subDays(today, 2)
  ),
  makeChatWrit(
    5,
    '~hastuc-dibtux',
    {
      block: [],
      inline: [{ link: { href: 'https://tlon.io/', content: '' } }],
    },
    undefined,
    subDays(today, 3)
  ),
  makeChatWrit(
    6,
    '~finned-palmer',
    {
      block: [],
      inline: ['hmmm...'],
    },
    undefined,
    subDays(today, 7)
  ),
  makeChatWrit(
    7,
    '~hastuc-dibtux',
    {
      block: [],
      inline: ['FIRST'],
    },
    undefined,
    subDays(today, 8)
  ),
];

export default chatWrits;

export const chatKeys = ['~zod/test'];

export const chatPerm = {
  writers: [],
};
