import { differenceInDays, endOfToday, format } from 'date-fns';
import emojiRegex from 'emoji-regex';
import _ from 'lodash';

export const IMAGE_REGEX =
  /(\.jpg|\.img|\.png|\.gif|\.tiff|\.jpeg|\.webp|\.svg)(?:\?.*)?$/i;
export const AUDIO_REGEX = /(\.mp3|\.wav|\.ogg|\.m4a)(?:\?.*)?$/i;
export const VIDEO_REGEX = /(\.mov|\.mp4|\.ogv|\.webm)(?:\?.*)?$/i;
export const URL_REGEX = /(https?:\/\/[^\s]+)/i;
export const PATP_REGEX = /(~[a-z0-9-]+)/i;
export const IMAGE_URL_REGEX =
  /^(http(s?):)([/.\w\s-:]|%2*)*\.(?:jpg|img|png|gif|tiff|jpeg|webp|svg)(?:\?.*)?$/i;
export const REF_REGEX = /\/1\/(chan|group|desk)\/[^\s]+/g;
export const REF_URL_REGEX = /^\/1\/(chan|group|desk)\/[^\s]+/;
// sig and hep explicitly left out
export const PUNCTUATION_REGEX = /[.,/#!$%^&*;:{}=_`()]/g;

export function isImageUrl(url: string) {
  return IMAGE_URL_REGEX.test(url);
}

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
