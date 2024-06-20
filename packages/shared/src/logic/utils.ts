import anyAscii from 'any-ascii';
import {
  differenceInCalendarDays,
  differenceInDays,
  endOfToday,
  format,
} from 'date-fns';
import emojiRegex from 'emoji-regex';
import { useMemo } from 'react';

import * as api from '../api';
import * as db from '../db';
import * as ub from '../urbit';

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

export function convertToAscii(str: string): string {
  const ascii = anyAscii(str);
  return ascii.toLowerCase().replaceAll(/[^a-zA-Z0-9-]/g, '-');
}

export const createShortCodeFromTitle = (title: string): string => {
  const shortCode = convertToAscii(title).replace(
    /[^a-z]*([a-z][-\w\d]+)/i,
    '$1'
  );
  return shortCode;
};

export function extractInlinesFromContent(story: api.PostContent): ub.Inline[] {
  const inlines =
    story !== null
      ? (story.filter((v) => 'inline' in v) as ub.VerseInline[]).flatMap(
          (i) => i.inline
        )
      : [];

  return inlines;
}

export function extractReferencesFromContent(
  story: api.PostContent
): api.ContentReference[] {
  const references =
    story !== null
      ? (story.filter(
          (s) => 'type' in s && s.type == 'reference'
        ) as api.ContentReference[])
      : [];

  return references;
}

export function extractBlocksFromContent(story: api.PostContent): ub.Block[] {
  const blocks =
    story !== null
      ? (story.filter((v) => 'block' in v) as ub.VerseBlock[]).flatMap(
          (b) => b.block
        )
      : [];

  return blocks;
}

export const extractContentTypes = (
  content: string
): {
  inlines: ub.Inline[];
  references: api.ContentReference[];
  blocks: ub.Block[];
  story: api.PostContent;
} => {
  const story = JSON.parse(content as string) as api.PostContent;
  const inlines = extractInlinesFromContent(story);
  const references = extractReferencesFromContent(story);
  const blocks = extractBlocksFromContent(story);

  return { inlines, references, blocks, story };
};

export const extractContentTypesFromPost = (
  post: db.Post
): {
  inlines: ub.Inline[];
  references: api.ContentReference[];
  blocks: ub.Block[];
  story: api.PostContent;
} => {
  const { inlines, references, blocks, story } = extractContentTypes(
    post.content as string
  );

  return { inlines, references, blocks, story };
};

export const isTextPost = (post: db.Post) => {
  const { inlines, references, blocks } = extractContentTypesFromPost(post);
  return blocks.length === 0 && inlines.length > 0 && references.length === 0;
};

export const isReferencePost = (post: db.Post) => {
  const { inlines, references, blocks } = extractContentTypesFromPost(post);
  return blocks.length === 0 && inlines.length === 0 && references.length === 1;
};

export const isImagePost = (post: db.Post) => {
  const { blocks } = extractContentTypesFromPost(post);
  return blocks.length === 1 && blocks.some((b) => 'image' in b);
};

export const findFirstImageBlock = (blocks: ub.Block[]): ub.Image | null => {
  return blocks.find((b) => 'image' in b) as ub.Image;
};

export const textPostIsLinkedImage = (post: db.Post): boolean => {
  const postIsJustText = isTextPost(post);
  if (!postIsJustText) {
    return false;
  }

  const { inlines } = extractContentTypesFromPost(post);

  if (inlines.length <= 2) {
    const [first] = inlines;
    if (typeof first === 'object' && 'link' in first) {
      const link = first as ub.Link;
      const { href } = link.link;
      const isImage = IMAGE_REGEX.test(href);

      return isImage;
    }
  }

  return false;
};

export const textPostIsReference = (post: db.Post): boolean => {
  const { inlines, references } = extractContentTypesFromPost(post);
  if (references.length === 0) {
    return false;
  }

  if (inlines.length === 2) {
    const [first] = inlines;
    const isRefString =
      typeof first === 'string' && REF_REGEX.test(first as string);

    if (isRefString) {
      return true;
    }
  }

  if (
    inlines.length === 1 &&
    typeof inlines[0] === 'object' &&
    'break' in inlines[0]
  ) {
    return true;
  }

  return false;
};

export const usePostMeta = (post: db.Post) => {
  const { inlines, references, blocks } = useMemo(
    () => extractContentTypesFromPost(post),
    [post]
  );
  const isText = useMemo(() => isTextPost(post), [post]);
  const isImage = useMemo(() => isImagePost(post), [post]);
  const isReference = useMemo(() => isReferencePost(post), [post]);
  const isLinkedImage = useMemo(() => textPostIsLinkedImage(post), [post]);
  const isRefInText = useMemo(() => textPostIsReference(post), [post]);
  const image = useMemo(
    () => (isImage ? findFirstImageBlock(blocks)?.image : undefined),
    [blocks, isImage]
  );
  const linkedImage = useMemo(
    () => (isLinkedImage ? (inlines[0] as ub.Link).link.href : undefined),
    [inlines, isLinkedImage]
  );

  return {
    isText,
    isImage,
    isReference,
    isLinkedImage,
    isRefInText,
    inlines,
    references,
    blocks,
    image,
    linkedImage,
  };
};

export const getCompositeGroups = (
  groups: db.Group[],
  base: Partial<db.Group>[]
): db.Group[] => {
  const baseIndex = base.reduce(
    (acc, curr) => {
      if (curr.id) {
        acc[curr.id] = curr;
      }
      return acc;
    },
    {} as Record<string, Partial<db.Group>>
  );

  return groups.map((group) => {
    const baseGroup = baseIndex[group.id] ?? {};
    return { ...baseGroup, ...group };
  });
};
