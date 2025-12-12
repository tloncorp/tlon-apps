import { render, valid } from '@urbit/aura';
import anyAscii from 'any-ascii';
import { differenceInDays, endOfToday, format } from 'date-fns';
import emojiRegex from 'emoji-regex';
import { BackoffOptions, backOff } from 'exponential-backoff';
import { useMemo } from 'react';

import * as api from '../api';
import {
  isDmChannelId,
  isGroupChannelId,
  isGroupDmChannelId,
} from '../api/apiUtils';
import * as db from '../db';
import * as domain from '../domain';
import * as ub from '../urbit';
import { Stringified } from '../utils';

export { isDmChannelId, isGroupChannelId, isGroupDmChannelId };

export const IMAGE_REGEX =
  /(\.jpg|\.img|\.png|\.gif|\.tiff|\.jpeg|\.webp|\.svg)(?:\?.*)?$/i;
export const AUDIO_REGEX = /(\.mp3|\.wav|\.ogg|\.m4a)(?:\?.*)?$/i;
export const VIDEO_REGEX = /(\.mov|\.mp4|\.ogv|\.webm)(?:\?.*)?$/i;
export const URL_REGEX = /^https?:\/\/[^\s]+$/i;
export const PATP_REGEX = /(~[a-z0-9-]+)/i;
export const IMAGE_URL_REGEX =
  /^(http(s?):)([/.\w\s-:]|%2*)*\.(?:jpg|img|png|gif|tiff|jpeg|webp|svg)(?:\?.*)?$/i;
export const REF_REGEX = /\/1\/(chan|group|desk)\/[^\s]+/g;
export const REF_URL_REGEX = /^\/1\/(chan|group|desk)\/[^\s]+/;
// sig and hep explicitly left out
export const PUNCTUATION_REGEX = /[.,/#!$%^&*;:{}=_`()]/g;

// Characters that look like tilde (~) and could be confusing
export const SIG_LIKES = [
  '\u007E', // ~ (tilde)
  '\u02DC', // ˜ (small tilde)
  '\u223C', // ∼ (tilde operator)
  '\u301C', // 〜 (wave dash)
  '\uFF5E', // ～ (fullwidth tilde)
  '\u2053', // ⁓ (swung dash)
  '\u2241', // ≁ (not tilde)
];

export function isValidUrl(str?: string): boolean {
  return str ? !!URL_REGEX.test(str) : false;
}

export type NicknameValidationErrorType =
  | 'confusable_characters'
  | 'invalid_patp'
  | 'wrong_user_id';

export type NicknameValidationResult =
  | { isValid: true }
  | {
      isValid: false;
      errorType: NicknameValidationErrorType;
    };

/**
 * Validates a nickname against several rules:
 * - Cannot contain characters that look like ~ (confusable characters)
 * - If it contains ~, it must be a valid patp
 * - If it contains a patp, it must be the current user's ID
 *
 * Uses Unicode normalization (NFKC) to handle confusable characters before validation.
 *
 * @param nickname The nickname to validate
 * @param currentUserId The current user's ID (patp)
 * @returns A validation result object with isValid flag and optional errorType
 */
export function validateNickname(
  nickname: string,
  currentUserId: string
): NicknameValidationResult {
  if (!nickname || nickname.length === 0) {
    return { isValid: true };
  }

  // Normalize unicode characters to handle confusables
  const normalizedNickname = nickname.normalize('NFKC');

  // Check for confusable characters (characters that look like ~)
  for (let i = 0; i < normalizedNickname.length; i++) {
    const char = normalizedNickname[i];
    const isConfusable = SIG_LIKES.some((sig: string) => sig === char);

    if (isConfusable && char !== '~') {
      return {
        isValid: false,
        errorType: 'confusable_characters',
      };
    }
  }

  // Check for patps in the nickname (use normalized version)
  if (normalizedNickname.includes('~')) {
    const matches = normalizedNickname.match(new RegExp(PATP_REGEX, 'gi'));
    if (matches) {
      for (const match of matches) {
        if (!valid('p', match)) {
          return {
            isValid: false,
            errorType: 'invalid_patp',
          };
        }
        if (match !== currentUserId) {
          return {
            isValid: false,
            errorType: 'wrong_user_id',
          };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Returns a user-friendly error message for a nickname validation error.
 * @param errorType The type of validation error
 * @returns A human-readable error message
 */
export function getNicknameErrorMessage(
  errorType: NicknameValidationErrorType
): string {
  switch (errorType) {
    case 'confusable_characters':
      return 'Nickname cannot contain characters that look like ~';
    case 'invalid_patp':
      return 'You can only use your own ID in your nickname';
    case 'wrong_user_id':
      return 'You can only use your own ID in your nickname';
  }
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

export function getFlagParts(flag: string) {
  const parts = flag.split('/');

  return {
    ship: parts[0],
    name: parts[1],
  };
}

export function getNestParts(nest: string) {
  const parts = nest.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid nest format: ${nest}`);
  }

  return {
    type: parts[0],
    ship: parts[1],
    name: parts[2],
  };
}

export function getPrettyAppName(kind: 'chat' | 'diary' | 'heap') {
  switch (kind) {
    case 'chat':
      return 'Chat';
    case 'diary':
      return 'Notebook';
    case 'heap':
      return 'Gallery';
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

export function normalizeUrbitColor(color?: string | null): string | null {
  if (!color) {
    return null;
  }

  if (color.startsWith('#')) {
    return color;
  }

  const noDots = color.replace('.', '');
  const prefixStripped = color.startsWith('0x') ? noDots.slice(2) : noDots;
  const lengthAdjustedColor = prefixStripped.toUpperCase().padStart(6, '0');
  return `#${lengthAdjustedColor}`;
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
): domain.ContentReference[] {
  const references =
    story !== null
      ? (story.filter(
          (s) => 'type' in s && s.type == 'reference'
        ) as domain.ContentReference[])
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
  content: Stringified<api.PostContent> | api.PostContent
): {
  inlines: ub.Inline[];
  references: domain.ContentReference[];
  blocks: ub.Block[];
  story: api.PostContent;
} => {
  const story = typeof content === 'string' ? JSON.parse(content) : content;
  const inlines = extractInlinesFromContent(story);
  const references = extractReferencesFromContent(story);
  const blocks = extractBlocksFromContent(story);

  return { inlines, references, blocks, story };
};

export const extractContentTypesFromPost = (
  post: db.Post | { content: api.PostContent }
): {
  inlines: ub.Inline[];
  references: domain.ContentReference[];
  blocks: ub.Block[];
  story: api.PostContent;
} => {
  const { inlines, references, blocks, story } = extractContentTypes(
    post.content as Stringified<api.PostContent>
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

export const isRichLinkPost = (post: db.Post) => {
  const { blocks } = extractContentTypesFromPost(post);
  return blocks.length === 1 && blocks.some((b) => 'link' in b);
};

export function getRichLinkMetadata(block: ub.Block):
  | {
      url: string;
      title?: string;
      description?: string;
      image?: string;
    }
  | undefined {
  if (!('link' in block)) {
    return undefined;
  }
  const { link } = block;
  const {
    url,
    meta: { title, description, image },
  } = link;
  return {
    url,
    title,
    description,
    image,
  };
}

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

export const textPostIsLink = (post: db.Post): boolean => {
  const postIsJustText = isTextPost(post);
  if (!postIsJustText) {
    return false;
  }

  const postIsImage = textPostIsLinkedImage(post);
  if (postIsImage) {
    return false;
  }

  const { inlines } = extractContentTypesFromPost(post);

  if (inlines.length <= 2) {
    const [first] = inlines;
    if (typeof first === 'object' && 'link' in first) {
      const link = first as ub.Link;
      const { href } = link.link;
      const isLink = URL_REGEX.test(href);

      return isLink;
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

export const getPostTypeFromChannelId = ({
  channelId,
  parentId,
}: {
  channelId?: string | null;
  parentId?: string | null;
}): db.PostType => {
  if (!channelId) return 'chat';
  const isDm = isDmChannelId(channelId) || isGroupDmChannelId(channelId);
  if (parentId) {
    return 'reply';
  } else if (isDm) {
    return 'chat';
  } else {
    const idType = channelId.split('/')[0];
    if (idType === 'diary') {
      return 'note';
    } else if (idType === 'heap') {
      return 'block';
    } else {
      return 'chat';
    }
  }
};

export const usePostMeta = (post: db.Post) => {
  const { inlines, references, blocks } = useMemo(
    () => extractContentTypesFromPost(post),
    [post]
  );
  const isText = useMemo(() => isTextPost(post), [post]);
  const isImage = useMemo(() => isImagePost(post), [post]);
  const isLink = useMemo(() => textPostIsLink(post), [post]);
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
    isLink,
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

export type RetryConfig = Pick<
  BackoffOptions,
  'startingDelay' | 'numOfAttempts' | 'maxDelay'
>;

export const withRetry = <T>(fn: () => Promise<T>, config?: RetryConfig) => {
  return backOff(fn, {
    delayFirstAttempt: false,
    startingDelay: config?.startingDelay ?? 1000,
    numOfAttempts: config?.numOfAttempts ?? 4,
    maxDelay: config?.maxDelay,
  });
};

/**
 * Random id value for group or channel, 4 bits of entropy, eg 0v2a.lmibb -> v2almibb
 */
export function getRandomId() {
  const id = render('uv', BigInt(Math.floor(Math.random() * 0xffffffff)));
  return id.replace(/\./g, '').slice(1);
}

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

const wayfindingGroup = domain.PersonalGroupSlugs;
function isWayfindingChannel(id: string | null | undefined): boolean {
  if (!id) return false;
  if (isDmChannelId(id)) return false;
  if (isGroupDmChannelId(id)) return false;

  const channelParts = getNestParts(id);
  return [
    wayfindingGroup.chatSlug,
    wayfindingGroup.collectionSlug,
    wayfindingGroup.notebookSlug,
  ].includes(channelParts.name);
}

function isWayfindingGroup(id: string | null | undefined): boolean {
  if (!id) return false;
  const groupParts = getFlagParts(id);
  return groupParts.name === wayfindingGroup.slug;
}

export function getModelAnalytics({
  post,
  group,
  channel,
}: {
  post?: Partial<db.Post> | null;
  group?: Partial<db.Group> | null;
  channel?: Partial<db.Channel> | null;
}) {
  const details: Record<string, string | boolean | null> = {};

  const isWayfindingGroupId = isWayfindingGroup(group?.id);
  const channelId = channel?.id || post?.channelId;
  const isWayfindingChannelId = isWayfindingChannel(channelId);

  if (isWayfindingGroupId || isWayfindingChannelId) {
    details.isPersonalGroup = true;
  }

  const isTlonTeamDM = channelId === '~wittyr-witbes'; // Tlon Team node
  if (isTlonTeamDM) {
    details.isTlonTeamDM = true;
  }

  // we want to mask all group/channel IDs unless:
  // 1. it's the default wayfinding group
  // 2. it's the Tlon Team DM
  const getMaskedId = (id: string | null | undefined) => {
    if (!id) return null;
    if (isWayfindingGroupId || isWayfindingChannelId) {
      return id;
    }

    if (isTlonTeamDM) {
      return id;
    }

    return id ? simpleHash(id) : null;
  };

  if (post) {
    details.postId = post.sentAt ? simpleHash(post.sentAt.toString()) : null;
    details.channelId = getMaskedId(post.channelId);
  }

  if (channel) {
    details.channelId = getMaskedId(channel.id);
    details.channelType = channel.type ?? null;
    details.groupId = getMaskedId(channel.groupId);
  }

  if (group) {
    details.groupId = getMaskedId(group.id);
    details.groupType =
      (group.channels?.length ?? 1) > 1 ? 'multi-topic' : 'groupchat';
    details.groupPrivacy = group.privacy ?? null;
  }

  return details;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
