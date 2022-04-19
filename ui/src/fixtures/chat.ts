import { ChatWrit } from '../types/chat';
import { decToUd, unixToDa } from '@urbit/api';
import { subMinutes } from 'date-fns';

export const makeChatWrit = (
  count: number,
  author: string,
  content: string
): ChatWrit => {
  let unix = subMinutes(new Date(), count * 5).getTime();
  const time = unixToDa(unix);
  const da = decToUd(time.toString());
  return {
    seal: {
      time: da,
      feels: {},
    },
    memo: {
      replying: null,
      author,
      sent: unix,
      content,
    },
  };
};

export const chatWrits: ChatWrit[] = [
  makeChatWrit(1, '~hastuc-dibtux', 'A test message'),
  makeChatWrit(2, '~hastuc-dibtux', 'A test message'),
  makeChatWrit(3, '~hastuc-dibtux', 'A test message'),
  makeChatWrit(4, '~hastuc-dibtux', 'A test message'),
  makeChatWrit(5, '~hastuc-dibtux', 'A test message'),
];
