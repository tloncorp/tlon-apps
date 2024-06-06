import { faker } from '@faker-js/faker';
import { Activity } from '@tloncorp/shared/dist/urbit/activity';
import {
  Post,
  Posts,
  Story,
  storyFromChatStory,
} from '@tloncorp/shared/dist/urbit/channel';
import { decToUd, unixToDa } from '@urbit/api';
import { subDays, subMinutes } from 'date-fns';
import _ from 'lodash';

import { AUTHORS } from '@/constants';
import { randomElement } from '@/logic/utils';

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
  reacts?: Record<string, string>,
  setTime?: Date
): Post => {
  const unix = getUnix(count, setTime);
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      id: `${author}/${da}`,
      reacts: reacts ?? {},
      replies: null,
      meta: {
        replyCount: 0,
        lastRepliers: [],
        lastReply: null,
      },
    },
    essay: {
      'kind-data': {
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
  setTime?: Date
): Post => {
  const unix = getUnix(count, setTime);
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      id: `${author}/${da}`,
      reacts: {},
      replies: null,
      meta: {
        replyCount: 0,
        lastRepliers: [],
        lastReply: null,
      },
    },
    essay: {
      'kind-data': {
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
}): Post[] => {
  const times = [];
  const messages: Post[] = [];
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
  const fakeChatWrits: Posts = _.keyBy(
    messageSequence({ start: subDays(new Date(), offset), count: 100 }),
    (val) => decToUd(unixToDa(val.essay.sent).toString())
  );

  return fakeChatWrits;
};

export const chatKeys = ['~zod/test'];

export const dmList: Activity = {
  '~fabled-faster': {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: {},
  },
  '~nocsyx-lassul': {
    recency: 1652302200000,
    count: 3,
    notify: false,
    unread: null,
    children: {},
  },
  '~fallyn-balfus': {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: {},
  },
  '~finned-palmer': {
    recency: 1652302200000,
    count: 2,
    notify: false,
    unread: null,
    children: {},
  },
  '~datder-sonnet': {
    recency: 1652302200000,
    count: 1,
    notify: false,
    unread: null,
    children: {},
  },
  '~hastuc-dibtux': {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: {},
  },
  '~rilfun-lidlen': {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: {},
  },
  '~mister-dister-dozzod-dozzod': {
    recency: 0,
    count: 0,
    notify: false,
    unread: null,
    children: {},
  },
};

export const chatPerm = {
  writers: [],
};

export const pendingDMs = ['~fabled-faster'];

export const pinnedDMs = ['~nocsyx-lassul'];
