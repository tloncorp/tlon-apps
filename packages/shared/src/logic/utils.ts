import { differenceInDays, endOfToday, format } from 'date-fns';
import emojiRegex from 'emoji-regex';
import _ from 'lodash';

export function makePrettyTime(date: Date) {
  return format(date, 'HH:mm');
}

export function makePrettyDay(date: Date) {
  const diff = differenceInDays(endOfToday(), date);
  switch (diff) {
    case 0:
      return 'Today';
    case 1:
      return 'Yesterday';
    default:
      return `${format(date, 'LLLL')} ${format(date, 'do')}`;
  }
}

export function makePrettyShortDate(date: Date) {
  return format(date, 'MMM dd, yyyy');
}

export function makeShortDate(date: Date) {
  return format(date, 'M/d/yy');
}

export interface DayTimeDisplay {
  original: Date;
  diff: number;
  day: string;
  time: string;
  asString: string;
}

export function makePrettyDayAndTime(date: Date): DayTimeDisplay {
  const diff = differenceInDays(endOfToday(), date);
  const time = makePrettyTime(date);
  let day = '';
  switch (true) {
    case diff === 0:
      day = 'Today';
      break;
    case diff === 1:
      day = 'Yesterday';
      break;
    case diff > 1 && diff < 8:
      day = format(date, 'cccc');
      break;
    default:
      day = `${format(date, 'LLLL')} ${format(date, 'do')}`;
  }

  return {
    original: date,
    diff,
    time,
    day,
    asString: `${day} • ${time}`,
  };
}

export interface DateDayTimeDisplay extends DayTimeDisplay {
  fullDate: string;
}

export function makePrettyDayAndDateAndTime(date: Date): DateDayTimeDisplay {
  const fullDate = `${format(date, 'LLLL')} ${format(date, 'do')}, ${format(
    date,
    'yyyy'
  )}`;
  const dayTime = makePrettyDayAndTime(date);

  if (dayTime.diff >= 8) {
    return {
      ...dayTime,
      fullDate,
      asString: `${fullDate} • ${dayTime.time}`,
    };
  }

  return {
    ...dayTime,
    fullDate,
    asString: `${dayTime.asString} • ${fullDate}`,
  };
}

export function isSingleEmoji(input: string): boolean {
  const regex = emojiRegex();
  const matches = input.match(regex);

  return (
    (matches &&
      matches.length === 1 &&
      matches.length === _.split(input, '').length) ??
    false
  );
}

export function normalizeUrbitColor(color: string): string {
  if (color.startsWith('#')) {
    return color;
  }

  const colorString = color.slice(2).replace('.', '').toUpperCase();
  const lengthAdjustedColor = _.padStart(colorString, 6, '0');
  return `#${lengthAdjustedColor}`;
}
