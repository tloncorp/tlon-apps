import { Brief, Han, Quip } from '@/types/channel';
import { daToUnix } from '@urbit/aura';
import bigInt, { BigInteger } from 'big-integer';
import { isSameDay } from 'date-fns';

export interface QuipProps {
  han: Han;
  noteId: string;
  time: BigInteger;
  quip: Quip;
  newAuthor: boolean;
  newDay: boolean;
  unreadCount?: number;
}

export function setNewDaysForQuips(
  quips: [string, QuipProps[]][]
): [string, QuipProps[]][] {
  return quips.map(([time, comments], index) => {
    const prev = index !== 0 ? quips[index - 1] : undefined;
    const prevQuipTime = prev ? bigInt(prev[0]) : undefined;
    const unix = new Date(daToUnix(bigInt(time)));

    const lastQuipDay = prevQuipTime
      ? new Date(daToUnix(prevQuipTime))
      : undefined;

    const newDay = lastQuipDay ? !isSameDay(unix, lastQuipDay) : false;

    const quip = comments.shift();
    if (!quip) {
      return [time, comments];
    }

    const newComments: QuipProps[] = [{ ...quip, newDay }, ...comments];
    return [time, newComments];
  });
}

export function groupQuips(
  noteId: string,
  quips: [bigInt.BigInteger, Quip][],
  brief: Brief
) {
  const grouped: Record<string, QuipProps[]> = {};
  let currentTime: string;

  quips.forEach(([t, q], i) => {
    const prev = i > 0 ? quips[i - 1] : undefined;
    const { author } = q.memo;
    const time = t.toString();
    const newAuthor = author !== prev?.[1].memo.author;
    const unreadBrief =
      brief && brief['read-id'] === q.cork.id ? brief : undefined;

    if (newAuthor) {
      currentTime = time;
    }

    if (!(currentTime in grouped)) {
      grouped[currentTime] = [];
    }

    grouped[currentTime].push({
      han: 'diary',
      time: t,
      quip: q,
      newAuthor,
      noteId,
      newDay: false,
      unreadCount: unreadBrief && brief.count,
    });
  });

  return Object.entries(grouped);
}
