import anyAscii from 'any-ascii';
import { format, differenceInDays } from 'date-fns';
import { Rank } from './types/groups';

export function renderRank(rank: Rank, plural = false) {
  if (rank === 'czar') {
    return plural ? 'Galaxies' : 'Galaxy';
  } else if (rank === 'king') {
    return plural ? 'Stars' : 'Star';
  } else if (rank === 'duke') {
    return plural ? 'Planets' : 'Planet';
  } else if (rank === 'earl') {
    return plural ? 'Moons' : 'Moon';
  } else {
    return plural ? 'Comets' : 'Comet';
  }
}

/**
 * Processes a string to make it `@tas` compatible
 */
export function strToSym(str: string): string {
  const ascii = anyAscii(str);
  return ascii.toLowerCase().replaceAll(/[^a-zA-Z0-9-]/g, '-');
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
