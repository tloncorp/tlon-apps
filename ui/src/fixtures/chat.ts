import { decToUd, unixToDa } from '@urbit/api';
import { subMinutes } from 'date-fns';
import { ChatWrit, MessageContent } from '../types/chat';

// eslint-disable-next-line import/prefer-default-export
export const makeChatWrit = (
  count: number,
  author: string,
  content: MessageContent
): ChatWrit => {
  const unix = subMinutes(new Date(), count * 5).getTime();
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

