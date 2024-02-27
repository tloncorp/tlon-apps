import {
  Kind,
  Reply,
  ReplyTuple,
  Unread,
} from '@tloncorp/shared/dist/urbit/channel';
import { daToUnix } from '@urbit/aura';
import bigInt, { BigInteger } from 'big-integer';
import { isSameDay } from 'date-fns';

export interface ReplyProps {
  han: Kind;
  noteId: string;
  time: BigInteger;
  reply: Reply;
  newAuthor: boolean;
  newDay: boolean;
  unreadCount?: number;
}

export function setNewDaysForReplies(
  replies: [string, ReplyProps[]][]
): [string, ReplyProps[]][] {
  return replies.map(([time, comments], index) => {
    const prev = index !== 0 ? replies[index - 1] : undefined;
    const prevReplyTime = prev ? bigInt(prev[0]) : undefined;
    const unix = new Date(daToUnix(bigInt(time)));

    const lastReplyDay = prevReplyTime
      ? new Date(daToUnix(prevReplyTime))
      : undefined;

    const newDay = lastReplyDay ? !isSameDay(unix, lastReplyDay) : false;

    const reply = comments.shift();
    if (!reply) {
      return [time, comments];
    }

    const newComments: ReplyProps[] = [{ ...reply, newDay }, ...comments];
    return [time, newComments];
  });
}

export function groupReplies(
  noteId: string,
  replies: ReplyTuple[],
  unread: Unread
) {
  const grouped: Record<string, ReplyProps[]> = {};
  let currentTime: string;

  replies.forEach(([t, q], i) => {
    if (q === null) {
      return;
    }

    const prev = i > 0 ? replies[i - 1] : undefined;
    const { author } = q.memo;
    const time = t.toString();
    const newAuthor =
      prev && prev[1] !== null ? author !== prev[1].memo.author : true;
    const unreadUnread =
      unread && unread.unread?.id === q.seal.id ? unread : undefined;

    if (newAuthor) {
      currentTime = time;
    }

    if (!(currentTime in grouped)) {
      grouped[currentTime] = [];
    }

    grouped[currentTime].push({
      han: 'diary',
      time: t,
      reply: q,
      newAuthor,
      noteId,
      newDay: false,
      unreadCount: unreadUnread && unread.count,
    });
  });

  return Object.entries(grouped);
}
