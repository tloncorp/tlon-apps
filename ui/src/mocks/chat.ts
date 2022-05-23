import { decToUd, unixToDa } from '@urbit/api';
import _ from 'lodash';
import { addDays, subDays, subMinutes } from 'date-fns';
import {
  ChatWrit,
  ChatWrits,
  ChatBriefs,
  ChatStory,
  ChatNotice,
} from '../types/chat';

const today = new Date();

export const makeChatWrit = (
  count: number,
  author: string,
  story: ChatStory,
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
      content: { story },
    },
  };
};
export const makeChatNotice = (
  count: number,
  author: string,
  notice: ChatNotice,
  setTime?: Date
): ChatWrit => {
  const unix = subMinutes(setTime ? setTime : new Date(), count * 5).getTime();
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      id: `${author}/${da}`,
      feels: {},
      replied: [],
    },
    memo: {
      replying: null,
      author,
      sent: unix,
      content: { notice },
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
    makeChatNotice(
      1,
      '~fabled-faster',
      {
        pfix: '',
        sfix: ' joined the channel',
      },
      undefined
    ),
    makeChatWrit(2, '~datder-sonnet', {
      inline: [],
      block: [
        {
          image: {
            src: 'https://user-images.githubusercontent.com/16504501/169683398-053fd525-f327-4628-a547-f66ddd28df4d.png',
            width: 491,
            height: 137,
            alt: '',
          },
        },
      ],
    }),
    makeChatWrit(
      9,
      '~datder-sonnet',
      {
        block: [],
        inline: ['Spamming the chat to test the virtual scroller...'],
      },
      undefined,
      today
    ),
    makeChatWrit(
      8,
      '~datder-sonnet',
      {
        block: [],
        inline: ['... still spamming'],
      },
      undefined,
      today
    ),
    makeChatWrit(
      7,
      '~datder-sonnet',
      {
        block: [],
        inline: ['okay another one to fill the screen'],
      },
      undefined,
      today
    ),
    makeChatWrit(
      6,
      '~datder-sonnet',
      {
        block: [],
        inline: ['blah blah blah'],
      },
      undefined,
      today
    ),
    makeChatWrit(
      5,
      '~datder-sonnet',
      {
        block: [],
        inline: ['yada yada yada'],
      },
      undefined,
      today
    ),
    makeChatWrit(
      4,
      '~datder-sonnet',
      {
        block: [],
        inline: ['still going ...'],
      },
      undefined,
      today
    ),
    makeChatWrit(
      3,
      '~datder-sonnet',
      {
        block: [],
        inline: ['alright, this should be enough'],
      },
      undefined,
      today
    ),
  ],
  (val) => decToUd(unixToDa(val.memo.sent).toString())
);

export default chatWrits;

export const chatKeys = ['~zod/test'];

export const dmList: ChatBriefs = {
  '~fabled-faster': {
    last: 0,
    count: 0,
    'read-id': null,
  },
  '~nocsyx-lassul': {
    last: 1652302200000,
    count: 3,
    'read-id': chatWrits[Object.keys(chatWrits)[0]].seal.id,
  },
  '~fallyn-ballus': {
    last: 0,
    count: 0,
    'read-id': null,
  },
  '~finned-palmer': {
    last: 1652302200000,
    count: 2,
    'read-id': chatWrits[Object.keys(chatWrits)[4]].seal.id,
  },
  '~datder-sonnet': {
    last: 1652302200000,
    count: 1,
    'read-id': chatWrits[Object.keys(chatWrits)[2]].seal.id,
  },
  '~hastuc-dibtux': {
    last: 0,
    count: 0,
    'read-id': null,
  },
};

export const chatPerm = {
  writers: [],
};
