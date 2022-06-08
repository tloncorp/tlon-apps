import { decToUd, udToDec, unixToDa } from '@urbit/api';
import _ from 'lodash';
import { subDays, subMinutes } from 'date-fns';
import faker from '@faker-js/faker';
import {
  ChatWrit,
  ChatWrits,
  ChatBriefs,
  ChatStory,
  ChatNotice,
} from '../types/chat';

const AUTHORS = [
  '~nocsyx-lassul',
  '~finned-palmer',
  '~hastuc-dibtux',
  '~datder-sonnet',
  '~rilfun-lidlen',
  '~ravmel-ropdyl',
  '~fabled-faster',
  '~fallyn-balfus',
  '~riprud-tidmel',
  '~wicdev-wisryt',
  '~rovnys-ricfer',
];

export const makeFakeChatWrit = (
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

export const unixToDaStr = (unix: number) => decToUd(unixToDa(unix).toString());

export const makeFakeChatNotice = (
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

export const randInt = (max: number, min = 1) =>
  faker.datatype.number({ max, min });

const generateMessage = (time: Date) => {
  const body = faker.lorem.sentences(randInt(5));
  const author = AUTHORS[randInt(AUTHORS.length - 1, 0)];

  const story = {
    block: [],
    inline: [body],
  };

  return makeFakeChatWrit(0, author, story, undefined, time);
};

export const messageSequence = ({
  start = new Date(),
  count,
}: {
  start?: Date;
  count: number;
}): ChatWrit[] => {
  const times = [];
  const messages: ChatWrit[] = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < count; i++) {
    times.push(subMinutes(start, i + randInt(30)));
  }
  times.sort();
  times.forEach((t) => {
    messages.push(generateMessage(t));
  });

  return messages;
};

export const makeFakeChatWrits = (offset: number) => {
  const fakeChatWrits: ChatWrits = _.keyBy(
    messageSequence({ start: subDays(new Date(), offset), count: 100 }),
    (val) => decToUd(unixToDa(val.memo.sent).toString())
  );

  return fakeChatWrits;
};

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
    'read-id': null,
  },
  '~fallyn-ballus': {
    last: 0,
    count: 0,
    'read-id': null,
  },
  '~finned-palmer': {
    last: 1652302200000,
    count: 2,
    'read-id': null,
  },
  '~datder-sonnet': {
    last: 1652302200000,
    count: 1,
    'read-id': null,
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

export const pendingDMs = ['~fabled-faster'];
