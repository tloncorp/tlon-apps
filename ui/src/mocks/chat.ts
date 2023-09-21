/* eslint-disable import/no-cycle */
import { decToUd, unixToDa } from '@urbit/api';
import _ from 'lodash';
import { subDays, subMinutes } from 'date-fns';
import faker from '@faker-js/faker';
import { AUTHORS } from '@/constants';
import { randomElement } from '@/logic/utils';
import { Note, Notes, Story, storyFromChatStory } from '@/types/channel';
import { DMBriefs, ChatNotice } from '../types/dms';

const getUnix = (count: number, setTime?: Date) =>
  count > 1
    ? subMinutes(setTime ? setTime : new Date(), count * 5).getTime()
    : setTime
    ? setTime.getTime()
    : new Date().getTime();

export const makeFakeChatWrit = (
  count: number,
  author: string,
  story: Story,
  feels?: Record<string, string>,
  setTime?: Date
): Note => {
  const unix = getUnix(count, setTime);
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      id: `${author}/${da}`,
      feels: feels ?? {},
      quips: null,
      meta: {
        quipCount: 0,
        lastQuippers: [],
        lastQuip: null,
      },
    },
    essay: {
      'han-data': {
        chat: null,
      },
      author,
      sent: unix,
      content: story,
    },
  };
};

export const unixToDaStr = (unix: number) => decToUd(unixToDa(unix).toString());

export const makeFakeChatNotice = (
  count: number,
  author: string,
  notice: ChatNotice,
  setTime?: Date
): Note => {
  const unix = getUnix(count, setTime);
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      id: `${author}/${da}`,
      feels: {},
      quips: null,
      meta: {
        quipCount: 0,
        lastQuippers: [],
        lastQuip: null,
      },
    },
    essay: {
      'han-data': {
        chat: {
          notice: null,
        },
      },
      author,
      sent: unix,
      content: [],
    },
  };
};

export const randInt = (max: number, min = 1) =>
  faker.datatype.number({ max, min });

const generateMessage = (time: Date) => {
  const body = faker.lorem.sentences(randInt(5));
  const author = randomElement(AUTHORS);

  const chatStory = {
    block: [],
    inline: [body],
  };

  const story = storyFromChatStory(chatStory);

  return makeFakeChatWrit(0, author, story, undefined, time);
};

export const messageSequence = ({
  start = new Date(),
  count,
}: {
  start?: Date;
  count: number;
}): Note[] => {
  const times = [];
  const messages: Note[] = [];
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
  const fakeChatWrits: Notes = _.keyBy(
    messageSequence({ start: subDays(new Date(), offset), count: 100 }),
    (val) => decToUd(unixToDa(val.essay.sent).toString())
  );

  return fakeChatWrits;
};

export const chatKeys = ['~zod/test'];

export const dmList: DMBriefs = {
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
  '~fallyn-balfus': {
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
  '~rilfun-lidlen': {
    last: 0,
    count: 0,
    'read-id': 'null',
  },
  '~mister-dister-dozzod-dozzod': {
    last: 0,
    count: 0,
    'read-id': null,
  },
};

export const chatPerm = {
  writers: [],
};

export const pendingDMs = ['~fabled-faster'];

export const pinnedDMs = ['~nocsyx-lassul'];
