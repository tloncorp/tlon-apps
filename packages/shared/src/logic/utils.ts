import {
  differenceInCalendarDays,
  differenceInDays,
  endOfToday,
  format,
} from 'date-fns';
import emojiRegex from 'emoji-regex';

import * as db from '../db';

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

export function isValidUrl(str?: string): boolean {
  return str ? !!URL_REGEX.test(str) : false;
}

export function isChatChannel(channel: db.Channel): boolean {
  return (
    channel.type === 'chat' ||
    channel.type === 'dm' ||
    channel.type === 'groupDm'
  );
}

export async function jsonFetch<T>(
  info: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(info, init);
  if (!res.ok) {
    throw new Error('Bad Fetch Response');
  }
  const data = await res.json();
  return data as T;
}

const isFacebookGraphDependent = (url: string) => {
  const caseDesensitizedURL = url.toLowerCase();
  return (
    caseDesensitizedURL.includes('facebook.com') ||
    caseDesensitizedURL.includes('instagram.com')
  );
};

export const validOembedCheck = (embed: any, url: string) => {
  if (!isFacebookGraphDependent(url)) {
    if (embed?.html) {
      return true;
    }
  }
  return false;
};

export function isImageUrl(url: string) {
  return IMAGE_URL_REGEX.test(url);
}

export function makePrettyTime(date: Date) {
  return format(date, 'HH:mm');
}

export function makePrettyTimeFromMs(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
      matches.length === input.split('').length) ??
    false
  );
}

export function normalizeUrbitColor(color: string): string {
  if (color.startsWith('#')) {
    return color;
  }

  const colorString = color.slice(2).replace('.', '').toUpperCase();
  const lengthAdjustedColor = colorString.padStart(6, '0');
  return `#${lengthAdjustedColor}`;
}

export function getPinPartial(channel: db.Channel): {
  type: db.PinType;
  itemId: string;
} {
  if (channel.groupId) {
    return { type: 'group', itemId: channel.groupId };
  }

  if (channel.type === 'dm') {
    return { type: 'dm', itemId: channel.id };
  }

  if (channel.type === 'groupDm') {
    return { type: 'groupDm', itemId: channel.id };
  }

  return { type: 'channel', itemId: channel.id };
}

export const isSameDay = (a: number, b: number) => {
  return differenceInCalendarDays(a, b) === 0;
};

export const isToday = (date: number) => {
  return isSameDay(date, Date.now());
};

export const appendContactIdToReplies = (
  existingReplies: string[],
  contactId: string
): string[] => {
  const newArray = [...existingReplies];
  const index = newArray.indexOf(contactId);
  if (index !== -1) {
    newArray.splice(index, 1);
  }
  newArray.push(contactId);
  return newArray;
};
