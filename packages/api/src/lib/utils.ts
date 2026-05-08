import anyAscii from 'any-ascii';
import { differenceInDays, endOfToday, format } from 'date-fns';
import emojiRegex from 'emoji-regex';
import { BackoffOptions, backOff } from 'exponential-backoff';

export const URL_REGEX = /^https?:\/\/[^\s]+$/i;
export const IMAGE_URL_REGEX =
  /^(http(s?):)([/.\w\s-:]|%2*)*\.(?:jpg|img|png|gif|tiff|jpeg|webp|svg)(?:\?.*)?$/i;
export const IMAGE_REGEX =
  /(\.jpg|\.img|\.png|\.gif|\.tiff|\.jpeg|\.webp|\.svg)(?:\?.*)?$/i;
export const AUDIO_REGEX = /(\.mp3|\.wav|\.ogg|\.m4a)(?:\?.*)?$/i;
export const VIDEO_REGEX = /(\.mov|\.mp4|\.ogv|\.webm)(?:\?.*)?$/i;

export function isValidUrl(str?: string): boolean {
  return str ? !!URL_REGEX.test(str) : false;
}

export async function asyncWithDefault<T>(
  cb: () => Promise<T>,
  def: T
): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    console.error(error);
    return def;
  }
}

export async function jsonFetch<T>(
  info: RequestInfo,
  init?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(info, init);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      console.error('jsonFetch error:', error.message);
      throw error;
    } else {
      console.error('jsonFetch unknown error:', error);
      throw new Error('Unknown error occurred during fetch');
    }
  }
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

export function makePrettyDurationFromSeconds(seconds: number | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) {
    return undefined;
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
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

export function makePrettyDaysSince(date: Date) {
  const diff = differenceInDays(endOfToday(), date);
  switch (diff) {
    case 0:
      return 'Today';
    case 1:
      return 'Yesterday';
    default:
      return `${diff}d ago`;
  }
}

export function makePrettyShortDate(date: Date) {
  return format(date, `MMMM do, yyyy`);
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

const emojiTestRegex = emojiRegex();

export function containsOnlyEmoji(input: string): boolean {
  const normalized = input.trim();

  if (normalized.length === 0) {
    return false;
  }

  if (normalized.length > 10) {
    return false;
  }
  // Lots of gotchas trying to figure out length of an emoji string. This is a
  // reasonably reliable way to do it in hermes. Should keep an eye on perf.
  // Some info here: https://stackoverflow.com/questions/54369513/how-to-count-the-correct-length-of-a-string-with-emojis-in-javascript
  return [...normalized].every((char) => {
    return !!char.match(emojiTestRegex);
  });
}

/**
 * Generates a safe ID from a given text.
 * @param text The text to generate a safe ID from.
 * @param prefix Optional prefix for the ID, defaults to 'id'.
 * @returns A safe ID.
 */
export const generateSafeId = (text: string, prefix: string = 'id') => {
  if (!text.match(/[a-zA-Z0-9]/)) {
    return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
  }
  return text.toLowerCase().replace(/\s/g, '-');
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000;

/**
 * Returns true if the two dates happened on current calendar day, in local
 * timezone.
 *
 * TODO: Currently this calculation will be off by an hour when crossing
 * daylight savings time. We're doing it this way because date operations are
 * quite slow in RN/Hermes.
 */
export const isSameDay = (a: number, b: number) => {
  const dayA = Math.floor((a - timezoneOffset) / MS_PER_DAY);
  const dayB = Math.floor((b - timezoneOffset) / MS_PER_DAY);
  return dayA === dayB;
};

export const isToday = (date: number) => {
  return isSameDay(date, Date.now());
};

export function convertToAscii(str: string): string {
  const ascii = anyAscii(str);
  return ascii.toLowerCase().replaceAll(/[^a-zA-Z0-9-]/g, '-');
}

export type RetryConfig = Pick<
  BackoffOptions,
  'startingDelay' | 'numOfAttempts' | 'maxDelay' | 'timeMultiple' | 'retry'
>;

export const withRetry = <T>(fn: () => Promise<T>, config?: RetryConfig) => {
  const options: BackoffOptions = {
    delayFirstAttempt: false,
    startingDelay: config?.startingDelay ?? 1000,
    numOfAttempts: config?.numOfAttempts ?? 4,
  };

  if (typeof config?.maxDelay === 'number') {
    options.maxDelay = config.maxDelay;
  }

  if (typeof config?.timeMultiple === 'number') {
    options.timeMultiple = config.timeMultiple;
  }

  if (config?.retry) {
    options.retry = config.retry;
  }

  return backOff(fn, options);
};

/**
 * Simple one way transform for identifying distinct values while
 * obscuring sensitive information, eg ~latter-bolden/garden -> rfn4hj
 */
export function simpleHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
