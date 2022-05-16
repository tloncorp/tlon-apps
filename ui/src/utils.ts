import anyAscii from 'any-ascii';
import { format, differenceInDays } from 'date-fns';
import { ChatWhom } from './types/chat';
import { Rank } from './types/groups';

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
  return `/groups/${flag}/channels/chat/${ch}`;
}

export function makePrettyDay(date: Date) {
  const diff = differenceInDays(new Date(), date);
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
  const diff = differenceInDays(new Date(), date);
  const time = format(date, 'HH:mm');
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
  const diff = differenceInDays(new Date(), date);
  const time = format(date, 'HH:mm');
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
  return !whom.match('/');
}
