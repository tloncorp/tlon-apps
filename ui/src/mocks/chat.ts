import { decToUd, unixToDa } from '@urbit/api';
import _ from 'lodash';
import { addDays, subDays, subMinutes } from 'date-fns';
import { ChatWrit, ChatMessage, ChatWrits } from '../types/chat';

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
      id: `${author}/${da}`,
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

const chatWrits: ChatWrits = _.keyBy(
  [
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
      '~finned-palmer',
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
    makeChatWrit(7, '~finned-palmer', {
      inline: [],
      block: [
        {
          image: {
            src: 'https://finned-palmer.s3.filebase.com/finned-palmer/2022.3.17..14.09.21-image.png',
            width: 1289,
            height: 661,
            alt: '',
          },
        },
      ],
    }),
    makeChatWrit(8, '~finned-palmer', {
      inline: [],
      block: [
        {
          image: {
            src: 'https://finned-palmer.s3.filebase.com/finned-palmer/2022.3.17..20.39.01-j-balla-photography-HvC0VnTkV5M-unsplash.jpg',
            width: 670,
            height: 1005,
            alt: 'beautiful jungle waterfall',
          },
        },
        {
          image: {
            src: 'https://finned-palmer.s3.filebase.com/finned-palmer/2022.3.23..17.22.38-image.png',
            width: 828,
            height: 196,
            alt: '',
          },
        },
      ],
    }),
    makeChatWrit(
      9,
      '~hastuc-dibtux',
      {
        block: [],
        inline: ['FIRST'],
      },
      undefined,
      subDays(today, 8)
    ),
  ],
  (val) => decToUd(unixToDa(val.memo.sent).toString())
);

export default chatWrits;

export const chatKeys = ['~zod/test'];

export const dmList = [
  '~fabled-faster',
  '~nocsyx-lassul',
  '~fallyn-ballus',
  '~finned-palmer',
  '~datder-sonnet',
  '~hastuc-dibtux',
];

export const chatPerm = {
  writers: [],
};
