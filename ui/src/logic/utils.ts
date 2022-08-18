import ob from 'urbit-ob';
import { unixToDa } from '@urbit/api';
import { formatUv } from '@urbit/aura';
import anyAscii from 'any-ascii';
import { format, differenceInDays, endOfToday } from 'date-fns';
import _ from 'lodash';
import { Chat, ChatWhom } from '@/types/chat';
import {
  Cabals,
  GroupChannel,
  ChannelPrivacyType,
  Cordon,
  PrivacyType,
  Rank,
} from '@/types/groups';
import { Heap } from '@/types/heap';
import { Suspender } from './suspend';

export function nestToFlag(nest: string): [string, string] {
  const [app, ...rest] = nest.split('/');

  return [app, rest.join('/')];
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

export function channelHref(flag: string, ch: string) {
  return `/groups/${flag}/channels/${ch}`;
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

export function makePrettyDayAndTime(date: Date) {
  const diff = differenceInDays(endOfToday(), date);
  const time = makePrettyTime(date);
  switch (true) {
    case diff === 0:
      return `Today • ${time}`;
    case diff === 1:
      return `Yesterday • ${time}`;
    case diff > 1 && diff < 8:
      return `${format(date, 'cccc')} • ${time}`;
    default:
      return `${format(date, 'LLLL')} ${format(date, 'do')} • ${time}`;
  }
}

export function makePrettyDayAndDateAndTime(date: Date) {
  const diff = differenceInDays(endOfToday(), date);
  const time = makePrettyTime(date);
  const fullDate = `${format(date, 'LLLL')} ${format(date, 'do')}, ${format(
    date,
    'yyyy'
  )}`;
  switch (true) {
    case diff === 0:
      return `Today • ${time} • ${fullDate}`;
    case diff === 1:
      return `Yesterday • ${time} • ${fullDate}`;
    case diff > 1 && diff < 8:
      return `${format(date, 'cccc')} • ${time} • ${fullDate}`;
    default:
      return `${fullDate} • ${time}`;
  }
}

export function whomIsDm(whom: ChatWhom): boolean {
  return whom.startsWith('~') && !whom.match('/');
}

// ship + term, term being a @tas: lower-case letters, numbers, and hyphens
export function whomIsFlag(whom: ChatWhom): boolean {
  return (
    /^~[a-z-]+\/[a-z]+[a-z0-9-]*$/.test(whom) &&
    ob.isValidPatp(whom.split('/')[0])
  );
}

export function whomIsMultiDm(whom: ChatWhom): boolean {
  return whom.startsWith(`0v`);
}

export function normalizeUrbitColor(color: string): string {
  if (color.startsWith('#')) {
    return color;
  }

  const colorString = color.slice(2).replace('.', '').toUpperCase();
  const lengthAdjustedColor = _.padEnd(colorString, 6, _.last(colorString));
  return `#${lengthAdjustedColor}`;
}

export function pluralize(word: string, count: number): string {
  if (count === 1) {
    return word;
  }

  return `${word}s`;
}

export function createStorageKey(name: string): string {
  return `~${window.ship}/${window.desk}/${name}`;
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

export function getFlagParts(flag: string) {
  const parts = flag.split('/');

  return {
    ship: parts[0],
    name: parts[1],
  };
}

export function getGroupPrivacy(cordon: Cordon): PrivacyType {
  if ('open' in cordon) {
    return 'public';
  }

  if ('shut' in cordon) {
    return 'private';
  }

  return 'secret';
}

export function getPrivacyFromChannel(
  groupChannel?: GroupChannel,
  channel?: Chat | Heap
): ChannelPrivacyType {
  if (!groupChannel || !channel) {
    return 'public';
  }

  if (groupChannel.readers.includes('admin')) {
    return 'secret';
  }

  if (channel.perms.writers.includes('admin')) {
    return 'read-only';
  }

  return 'public';
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

export function hasKeys(obj: Record<string, unknown>) {
  return Object.keys(obj).length > 0;
}

export const IMAGE_REGEX =
  /(\.jpg|\.img|\.png|\.gif|\.tiff|\.jpeg|\.webp|\.webm|\.svg)$/i;
export const AUDIO_REGEX = /(\.mp3|\.wav|\.ogg|\.m4a)$/i;
export const VIDEO_REGEX = /(\.mov|\.mp4|\.ogv)$/i;
export const URL_REGEX = /(https?:\/\/[^\s]+)/i;

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

export const validOembedCheck = (embed: Suspender<any>, url: string) => {
  if (!isFacebookGraphDependent(url)) {
    if (
      !Object.prototype.hasOwnProperty.call(embed, 'error') &&
      embed.read().html
    ) {
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
