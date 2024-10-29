import { MessageKey } from '@tloncorp/shared/urbit/activity';
import {
  CacheId,
  ChatStory,
  Cite,
  Listing,
  Post,
  Story,
  Verse,
  VerseBlock,
  VerseInline,
} from '@tloncorp/shared/urbit/channel';
import {
  Bold,
  Inline,
  Italics,
  Strikethrough,
} from '@tloncorp/shared/urbit/content';
import {
  Cabals,
  ChannelPrivacyType,
  Cordon,
  Gang,
  Group,
  GroupChannel,
  GroupPreview,
  PrivacyType,
  Rank,
  Saga,
} from '@tloncorp/shared/urbit/groups';
import {
  BigIntOrderedMap,
  Docket,
  DocketHref,
  Treaty,
  udToDec,
} from '@urbit/api';
import { formatUd, formatUv, unixToDa } from '@urbit/aura';
import anyAscii from 'any-ascii';
import bigInt, { BigInteger } from 'big-integer';
import { hsla, parseToHsla, parseToRgba } from 'color2k';
import { differenceInDays, endOfToday, format } from 'date-fns';
import emojiRegex from 'emoji-regex';
import _ from 'lodash';
import { useCallback, useMemo, useRef, useState } from 'react';
import ob from 'urbit-ob';
import { useCopyToClipboard } from 'usehooks-ts';
import isURL from 'validator/es/lib/isURL';

export const isStagingHosted =
  import.meta.env.DEV ||
  (import.meta.env.VITE_SHIP_URL || '').endsWith('.test.tlon.systems') ||
  window.location.hostname.endsWith('.test.tlon.systems');
export const isHosted =
  isStagingHosted ||
  (import.meta.env.VITE_SHIP_URL || '').endsWith('.tlon.network') ||
  window.location.hostname.endsWith('.tlon.network');

export const hostingUploadURL = isStagingHosted
  ? 'https://memex.test.tlon.systems'
  : isHosted
    ? 'https://memex.tlon.network'
    : '';

export const dmListPath = '/messages';

export function createDevLogger(tag: string, enabled: boolean) {
  return new Proxy(console, {
    get(target: Console, prop, receiver) {
      return (...args: unknown[]) => {
        if (enabled && import.meta.env.DEV) {
          const val = Reflect.get(target, prop, receiver);
          val(`[${tag}]`, ...args);
        }
      };
    },
  });
}

export function log(...args: any[]) {
  if (import.meta.env.DEV) {
    const { stack } = new Error();
    const line = stack?.split('\n')[2].trim();
    console.log(`${line}:`, ...args);
  }
}

/**
 * Logs a message when any property of an object changes. Uses shallow equality
 * check to determine whether a change has occurred.
 */
export function useObjectChangeLogging(
  o: Record<string, unknown>,
  logger: Console = window.console
) {
  const lastValues = useRef(o);
  Object.entries(o).forEach(([k, v]) => {
    if (v !== lastValues.current[k]) {
      logger.log('[change]', k, 'old:', lastValues.current[k], 'new:', v);
      lastValues.current[k] = v;
    }
  });
}

export function logTime(...args: any[]) {
  return log(...[performance.now(), ...args]);
}

type App = 'chat' | 'heap' | 'diary';

export function checkNest(nest: string) {
  if (nest.split('/').length !== 3) {
    if (import.meta.env.DEV) {
      throw new Error('Invalid nest');
    } else {
      console.error('Invalid nest:', nest);
    }
  }
}

export function nestToFlag(nest: string): [App, string] {
  checkNest(nest);
  const [app, ...rest] = nest.split('/');

  return [app as App, rest.join('/')];
}

export function renderRank(rank: Rank, plural = false) {
  if (rank === 'czar') {
    return plural ? 'Galaxies' : 'Galaxy';
  }
  if (rank === 'king') {
    return plural ? 'Stars' : 'Star';
  }
  if (rank === 'duke') {
    return plural ? 'Planets' : 'Planet';
  }
  if (rank === 'earl') {
    return plural ? 'Moons' : 'Moon';
  }
  return plural ? 'Comets' : 'Comet';
}

/**
 * Processes a string to make it `@tas` compatible
 */
export function strToSym(str: string): string {
  const ascii = anyAscii(str);
  return ascii.toLowerCase().replaceAll(/[^a-zA-Z0-9-]/g, '-');
}

//  encode the string into @ta-safe format, using logic from +wood.
//  for example, 'some Chars!' becomes '~.some.~43.hars~21.'
//  this is equivalent to (scot %t string), and is url-safe encoding for
//  arbitrary strings.
//
//  TODO  should probably go into aura-js
export function stringToTa(string: string) {
  let out = '';
  for (let i = 0; i < string.length; i += 1) {
    const char = string[i];
    let add = '';
    switch (char) {
      case ' ':
        add = '.';
        break;
      case '.':
        add = '~.';
        break;
      case '~':
        add = '~~';
        break;
      default: {
        const codePoint = string.codePointAt(i);
        if (!codePoint) break;
        //  js strings are encoded in UTF-16, so 16 bits per character.
        //  codePointAt() reads a _codepoint_ at a character index, and may
        //  consume up to two js string characters to do so, in the case of
        //  16 bit surrogate pseudo-characters. here we detect that case, so
        //  we can advance the cursor to skip past the additional character.
        if (codePoint > 0xffff) i += 1;
        if (
          (codePoint >= 97 && codePoint <= 122) || // a-z
          (codePoint >= 48 && codePoint <= 57) || // 0-9
          char === '-'
        ) {
          add = char;
        } else {
          add = `~${codePoint.toString(16)}.`;
        }
      }
    }
    out += add;
  }
  return `~~${out}`;
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

export function makePrettyDate(date: Date) {
  return `${format(date, 'PPP')}`;
}

export function makePrettyShortDate(date: Date) {
  return format(date, 'MMM dd, yyyy');
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

export function whomIsDm(whom: string): boolean {
  return whom.startsWith('~') && !whom.match('/') && !whom.startsWith('~~');
}

export function whomIsBroadcast(whom: string): boolean {
  return whom.startsWith('~~');
}

// ship + term, term being a @tas: lower-case letters, numbers, and hyphens
export function whomIsFlag(whom: string): boolean {
  return (
    /^~[a-z-]+\/[a-z]+[a-z0-9-]*$/.test(whom) &&
    ob.isValidPatp(whom.split('/')[0])
  );
}

export function whomIsNest(whom: string): boolean {
  return (
    /^[a-z]+\/~[a-z-]+\/[a-z]+[a-z0-9-]*$/.test(whom) &&
    ob.isValidPatp(whom.split('/')[1])
  );
}

export function whomIsMultiDm(whom: string): boolean {
  return whom.startsWith(`0v`);
}

export function normalizeUrbitColor(color: string): string {
  if (color.startsWith('#')) {
    return color;
  }

  const colorString = color.slice(2).replace('.', '').toUpperCase();
  const lengthAdjustedColor = _.padStart(colorString, 6, '0');
  return `#${lengthAdjustedColor}`;
}

export function isColor(color: string): boolean {
  try {
    parseToRgba(color);
    return true;
  } catch (error) {
    return false;
  }
}

export function pluralize(word: string, count: number): string {
  if (count === 1) {
    return word;
  }

  return `${word}s`;
}

export function createStorageKey(name: string): string {
  return `~${window.ship}/landscape/${name}`;
}

// for purging storage with version updates
export function clearStorageMigration<T>() {
  return {} as T;
}

export const storageVersion = parseInt(
  import.meta.env.VITE_STORAGE_VERSION,
  10
);

export function preSig(ship: string): string {
  if (!ship) {
    return '';
  }

  if (ship.trim().startsWith('~')) {
    return ship.trim();
  }

  return '~'.concat(ship.trim());
}

export function newUv(seed = Date.now()) {
  return formatUv(unixToDa(seed));
}

export function getSectTitle(cabals: Cabals, sect: string) {
  return cabals[sect]?.meta.title || sect;
}

export function getPatdaParts(patda: string) {
  const parts = patda.split('/');

  return {
    ship: parts[0],
    time: parts[1],
    timeDec: udToDec(parts[1]),
  };
}

export function getFlagParts(flag: string) {
  const parts = flag.split('/');

  return {
    ship: parts[0],
    name: parts[1],
  };
}

export function getPrivacyFromCordon(cordon: Cordon): PrivacyType {
  if ('shut' in cordon) {
    return 'private';
  }

  return 'public';
}

export function getPrivacyFromPreview(preview: GroupPreview) {
  if (preview.secret) {
    return 'secret';
  }

  return getPrivacyFromCordon(preview.cordon);
}

export function getPrivacyFromGroup(group: Group): PrivacyType {
  if (group.secret) {
    return 'secret';
  }

  return getPrivacyFromCordon(group.cordon);
}

export function getPrivacyFromGang(gang: Gang): PrivacyType {
  if (!gang.preview || gang.preview.secret) {
    return 'secret';
  }

  return getPrivacyFromCordon(gang.preview.cordon);
}

export interface WritePermissions {
  perms: {
    writers: string[];
  };
}

export function getPrivacyFromChannel(
  groupChannel?: GroupChannel,
  channel?: WritePermissions
): ChannelPrivacyType {
  if (!groupChannel || !channel) {
    return 'public';
  }

  if (groupChannel.readers.length > 0 || channel.perms.writers.length > 0) {
    return 'custom';
  }

  return 'public';
}

export function pluralRank(
  rank: 'galaxy' | 'star' | 'planet' | 'moon' | 'comet'
) {
  switch (rank) {
    case 'galaxy':
      return 'galaxies';
    default:
      return `${rank}s`;
  }
}

export function rankToClan(
  rank: 'czar' | 'king' | 'duke' | 'earl' | 'pawn' | string
) {
  switch (rank) {
    case 'czar':
      return 'galaxy';
    case 'king':
      return 'star';
    case 'duke':
      return 'planet';
    case 'earl':
      return 'moon';
    default:
      return 'comet';
  }
}

export function matchesBans(
  cordon: Cordon,
  ship: string
): ReturnType<typeof ob.clan> | 'ship' | null {
  const siggedShip = preSig(ship);
  if (!('open' in cordon)) {
    return null;
  }

  if (cordon.open.ships.includes(siggedShip)) {
    return 'ship';
  }

  const clan = ob.clan(siggedShip);
  if (cordon.open.ranks.map(rankToClan).includes(clan)) {
    return clan;
  }

  return null;
}

export function toTitleCase(s: string): string {
  if (!s) {
    return '';
  }
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function randomElement<T>(a: T[]) {
  return a[Math.floor(Math.random() * a.length)];
}

export function randomIntInRange(min: number, max: number) {
  return Math.round(Math.random() * (max - min) + min);
}

export function hasKeys(obj: Record<string, unknown>) {
  return Object.keys(obj).length > 0;
}

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

export function isMediaUrl(url: string) {
  return (
    isURL(url) &&
    (IMAGE_REGEX.test(url) || VIDEO_REGEX.test(url) || AUDIO_REGEX.test(url))
  );
}

export function isRef(text: string) {
  return text.match(REF_URL_REGEX);
}

export function isValidUrl(str?: string): boolean {
  return str ? !!URL_REGEX.test(str) : false;
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

export function isGroupHost(flag: string) {
  const { ship } = getFlagParts(flag);
  return ship === window.our;
}

/**
 * Since there is no metadata persisted in a curio to determine what kind of
 * curio it is (Link or Text), this function determines by checking the
 * content's structure.
 *
 * @param content CurioContent
 * @returns boolean
 */
export function isLinkCurio({ inline }: ChatStory) {
  return (
    inline.length === 1 && typeof inline[0] === 'object' && 'link' in inline[0]
  );
}

export function linkFromCurioContent(content: ChatStory) {
  if (isLinkCurio(content)) {
    return content.inline[0] as string;
  }

  return '';
}

export function getFirstInline(content: Story) {
  const inlines = content.filter((v) => 'inline' in v) as VerseInline[];
  if (inlines.length === 0) {
    return null;
  }

  return inlines[0].inline;
}

export function citeToPath(cite: Cite) {
  if ('desk' in cite) {
    return `/1/desk/${cite.desk.flag}${cite.desk.where}`;
  }
  if ('chan' in cite) {
    return `/1/chan/${cite.chan.nest}${cite.chan.where}`;
  }
  if ('group' in cite) {
    return `/1/group/${cite.group}`;
  }

  return `/1/bait/${cite.bait.group}/${cite.bait.graph}/${cite.bait.where}`;
}

export function pathToCite(path: string): Cite | undefined {
  const segments = path.split('/');
  if (segments.length < 3) {
    return undefined;
  }
  const [, ver, kind, ...rest] = segments;
  if (ver !== '1') {
    return undefined;
  }
  if (kind === 'chan') {
    if (rest.length < 3) {
      return undefined;
    }
    const nest = rest.slice(0, 3).join('/');
    return {
      chan: {
        nest,
        where: `/${rest.slice(3).join('/')}` || '/',
      },
    };
  }
  if (kind === 'desk') {
    if (rest.length < 2) {
      return undefined;
    }
    const flag = rest.slice(0, 2).join('/');
    return {
      desk: {
        flag,
        where: `/${rest.slice(2).join('/')}` || '/',
      },
    };
  }
  if (kind === 'group') {
    if (rest.length !== 2) {
      return undefined;
    }
    return {
      group: rest.join('/'),
    };
  }
  return undefined;
}

export function useCopy(copied: string) {
  const [didCopy, setDidCopy] = useState(false);
  const [, copy] = useCopyToClipboard();

  const copyFallback = async (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (error) {
      console.warn('Fallback copy failed', error);
      return false;
    }
  };

  const doCopy = useCallback(async () => {
    let success = false;
    if (!navigator.clipboard) {
      success = await copyFallback(copied);
    } else {
      success = await copy(copied);
    }

    setDidCopy(success);

    let timeout: NodeJS.Timeout;
    if (success) {
      timeout = setTimeout(() => {
        setDidCopy(false);
      }, 2000);
    }

    return () => {
      setDidCopy(false);
      clearTimeout(timeout);
    };
  }, [copied, copy]);

  return { doCopy, didCopy };
}

export function getNestShip(nest: string) {
  const [, flag] = nestToFlag(nest);
  const { ship } = getFlagParts(flag);
  return ship;
}

export async function asyncWithDefault<T>(
  cb: () => Promise<T>,
  def: T
): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    return def;
  }
}

export async function asyncWithFallback<T>(
  cb: () => Promise<T>,
  def: (error: any) => Promise<T>
): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    return def(error);
  }
}

export function getDarkColor(color: string): string {
  const hslaColor = parseToHsla(color);
  return hsla(hslaColor[0], hslaColor[1], 1 - hslaColor[2], 1);
}
export function getAppHref(href: DocketHref) {
  return 'site' in href ? href.site : `/apps/${href.glob.base}/`;
}

export function disableDefault<T extends Event>(e: T): void {
  e.preventDefault();
}

export function handleDropdownLink(
  setOpen?: (open: boolean) => void
): (e: Event) => void {
  return (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    setTimeout(() => setOpen?.(false), 15);
  };
}

export function getAppName(
  app: (Docket & { desk: string }) | Treaty | undefined
): string {
  if (!app) {
    return '';
  }

  return app.title || app.desk;
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

export function initializeMap<T>(items: Record<string, T>) {
  let map = new BigIntOrderedMap<T>();
  Object.entries(items).forEach(([k, v]) => {
    map = map.set(bigInt(k), v as T);
  });

  return map;
}

export function restoreMap<T>(obj: any): BigIntOrderedMap<T> {
  const empty = new BigIntOrderedMap<T>();
  if (!obj) {
    return empty;
  }

  if ('has' in obj) {
    return obj;
  }

  if ('root' in obj) {
    return initializeMap(obj.root);
  }

  return empty;
}

export function sliceMap<T>(
  theMap: BigIntOrderedMap<T>,
  start: BigInteger,
  end: BigInteger
): BigIntOrderedMap<T> {
  let empty = new BigIntOrderedMap<T>();

  [...theMap].forEach(([k, v]) => {
    if (k.geq(start) && k.leq(end)) {
      empty = empty.set(k, v);
    }
  });

  return empty;
}

const apps = ['chat', 'groups', 'channels', 'reel', 'grouper'];
const groups = [
  'create',
  'zone',
  'mov',
  'mov-nest',
  'secret',
  'cordon',
  'open',
  'shut',
  'add-ships',
  'del-ships',
  'add-ranks',
  'del-ranks',
  'join',
  'cabal',
  'fleet',
];
const chat = [
  'chat-dm-action',
  'chat-club-action-0',
  'chat-dm-archive',
  'chat-dm-unarchive',
  'chat-dm-rsvp',
  'chat-club-create',
  'chat-block-ship',
  'chat-unblock-ship',
  'hive',
  'writ',
];
const channels = [
  'channel-action',
  'leave',
  'add-writers',
  'del-writers',
  'post',
];
const lure = ['grouper-enable', 'grouper-disable'];
const misc = [
  'saw-seam',
  'saw-rope',
  'anon',
  'settings-event',
  'put-bucket',
  'del-bucket',
  'put-entry',
  'del-entry',
];
const wrappers = ['update', 'diff', 'delta', 'action', 'channel'];
const general = [
  'add-sects',
  'del-sects',
  'view',
  'add',
  'del',
  'edit',
  'add-react',
  'del-react',
  'meta',
  'init',
  'reply',
];

export function actionDrill(
  obj: Record<string, unknown>,
  level = 0,
  prefix = ''
): string[] {
  const keys: string[] = [];
  const allowed = general.concat(
    wrappers,
    apps,
    groups,
    misc,
    chat,
    channels,
    lure
  );

  Object.entries(obj).forEach(([key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!allowed.includes(key)) {
      return;
    }

    const skip = wrappers.includes(key);
    const deeper =
      val &&
      typeof val === 'object' &&
      Object.keys(val).some((k) => allowed.includes(k));

    if (deeper && level < 4) {
      // continue deeper and skip the key if just a wrapper, otherwise add on to path
      keys.push(
        ...actionDrill(
          val as Record<string, unknown>,
          skip ? level : level + 1,
          skip ? prefix : path
        )
      );
    } else {
      keys.push(path);
    }
  });

  return keys.filter((k) => k !== '');
}

export function parseKind(json: Record<string, unknown>): string {
  const nest =
    // eslint-disable-next-line
    // @ts-ignore
    json && json.channel && json.channel.nest ? json.channel.nest : '';

  if (nest.includes('heap/~')) {
    return 'heap';
  }

  if (nest.includes('diary/~')) {
    return 'diary';
  }

  if (nest.includes('chat/~')) {
    return 'chat';
  }

  return '';
}

export function truncateProse(content: Story, maxCharacters: number): Story {
  const truncate = (
    [head, ...tail]: Inline[],
    remainingChars: number,
    acc: Inline[]
  ): { truncatedItems: Inline[]; remainingChars: number } => {
    if (!head || remainingChars <= 0) {
      return { truncatedItems: acc, remainingChars };
    }

    let willBeEnd = false;

    if (typeof head === 'string') {
      const truncatedString = head.slice(0, remainingChars);
      willBeEnd = remainingChars - truncatedString.length <= 0;
      return truncate(tail, remainingChars - truncatedString.length, [
        ...acc,
        truncatedString.concat(willBeEnd ? '...' : ''),
      ]);
    }

    if ('bold' in head && typeof head.bold[0] === 'string') {
      const truncatedString = (head.bold[0] as string).slice(0, remainingChars);
      willBeEnd = remainingChars - truncatedString.length <= 0;
      const truncatedBold: Bold = {
        bold: [truncatedString.concat(willBeEnd ? '...' : '')],
      };
      return truncate(tail, remainingChars - truncatedString.length, [
        ...acc,
        truncatedBold,
      ]);
    }

    if ('italics' in head && typeof head.italics[0] === 'string') {
      const truncatedString = (head.italics[0] as string).slice(
        0,
        remainingChars
      );
      willBeEnd = remainingChars - truncatedString.length <= 0;
      const truncatedItalics: Italics = {
        italics: [truncatedString.concat(willBeEnd ? '...' : '')],
      };
      return truncate(tail, remainingChars - truncatedString.length, [
        ...acc,
        truncatedItalics,
      ]);
    }

    if ('strike' in head && typeof head.strike[0] === 'string') {
      const truncatedString = (head.strike[0] as string).slice(
        0,
        remainingChars
      );
      willBeEnd = remainingChars - truncatedString.length <= 0;
      const truncatedStrike: Strikethrough = {
        strike: [truncatedString.concat(willBeEnd ? '...' : '')],
      };
      return truncate(tail, remainingChars - truncatedString.length, [
        ...acc,
        truncatedStrike,
      ]);
    }

    return truncate(tail, remainingChars, [...acc, head]);
  };

  let remainingChars = maxCharacters;
  let remainingImages = 1;

  const truncatedContent: Story = content
    .map((verse: Verse): Verse => {
      if ('inline' in verse) {
        const lengthBefore = remainingChars;
        const { truncatedItems, remainingChars: updatedRemainingChars } =
          truncate(verse.inline, remainingChars, []);
        const truncatedVerse: VerseInline = {
          inline: truncatedItems,
        };

        remainingChars -= lengthBefore - updatedRemainingChars;
        return truncatedVerse;
      }

      if ('block' in verse) {
        if (remainingChars <= 0) {
          return {
            inline: [''],
          };
        }

        if ('cite' in verse.block) {
          return {
            inline: [''],
          };
        }

        if ('image' in verse.block) {
          if (remainingImages <= 0) {
            return {
              inline: [''],
            };
          }

          remainingImages -= 1;
          return verse;
        }

        if ('header' in verse.block) {
          // apparently users can add headers if they paste in content from elsewhere
          const lengthBefore = remainingChars;
          const { truncatedItems, remainingChars: updatedRemainingChars } =
            truncate(verse.block.header.content, remainingChars, []);
          const truncatedVerse: VerseBlock = {
            block: {
              header: {
                ...verse.block.header,
                content: truncatedItems,
              },
            },
          };
          remainingChars = lengthBefore - updatedRemainingChars;
          return truncatedVerse;
        }

        if (
          'listing' in verse.block &&
          'list' in verse.block.listing &&
          'items' in verse.block.listing.list
        ) {
          const lengthBefore = remainingChars;
          const {
            truncatedListItems,
            remainingChars: remainingCharsAfterList,
          } = verse.block.listing.list.items.reduce(
            (
              accumulator: {
                truncatedListItems: Listing[];
                remainingChars: number;
              },
              listing: Listing
            ) => {
              if ('item' in listing) {
                const lengthBeforeList = accumulator.remainingChars;

                if (lengthBeforeList <= 0) {
                  return accumulator;
                }

                const {
                  truncatedItems,
                  remainingChars: updatedRemainingChars,
                } = truncate(listing.item, lengthBeforeList, []);
                const truncatedListing = {
                  item: truncatedItems,
                };
                const remainingCharsInReducer =
                  lengthBeforeList - updatedRemainingChars;
                return {
                  truncatedListItems: [
                    ...accumulator.truncatedListItems,
                    truncatedListing,
                  ],
                  remainingChars: remainingCharsInReducer,
                };
              }
              return accumulator;
            },
            { truncatedListItems: [], remainingChars }
          );

          remainingChars = remainingCharsAfterList;
          const truncatedVerse: VerseBlock = {
            block: {
              listing: {
                list: {
                  ...verse.block.listing.list,
                  items: truncatedListItems,
                },
              },
            },
          };
          remainingChars -= lengthBefore - remainingChars;
          return truncatedVerse;
        }

        return verse;
      }

      return verse;
    })
    .filter((verse: Verse): boolean => {
      if ('inline' in verse) {
        return verse.inline.length > 0;
      }
      return true;
    });

  return truncatedContent;
}

export const greenConnection = {
  name: 'green',
  dot: 'text-green-400',
  bar: 'border-green-200 bg-green-50 text-green-500',
};

export const yellowConnection = {
  name: 'yellow',
  dot: 'text-yellow-400',
  bar: 'border-yellow-400 bg-yellow-50 text-yellow-500',
};

export const redConnection = {
  name: 'red',
  dot: 'text-red-400',
  bar: 'border-red-400 bg-red-50 text-red-500',
};

export const grayConnection = {
  name: 'gray',
  dot: 'text-gray-400',
  bar: 'border-gray-400 bg-gray-50 text-gray-500',
};

export function getCompatibilityText(saga: Saga | null) {
  if (saga && 'behind' in saga) {
    return 'Host requires an update to communicate';
  }

  if (saga && 'ahead' in saga) {
    return 'Your Groups app requires an update to communicate';
  }

  return "You're synced with host";
}

export function sagaCompatible(saga: Saga | null) {
  // either host or synced with host
  return saga === null || 'synced' in saga;
}

export function useIsHttps() {
  return window.location.protocol === 'https:';
}

export function useIsDmOrMultiDm(whom: string) {
  return useMemo(() => whomIsDm(whom) || whomIsMultiDm(whom), [whom]);
}

export function cacheIdToString(id: CacheId) {
  return `${id.author}/${id.sent}`;
}

export function cacheIdFromString(str: string): CacheId {
  const [author, sentStr] = str.split('/');
  return {
    author,
    sent: parseInt(udToDec(sentStr), 10),
  };
}

export function getMessageKey(post: Post): MessageKey {
  return {
    id: `${post.essay.author}/${formatUd(unixToDa(post.essay.sent))}`,
    time: formatUd(bigInt(post.seal.id)),
  };
}
