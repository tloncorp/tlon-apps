import { format, differenceInDays, endOfToday } from 'date-fns';

export const URBIT_HOME_REGEX = /\<title\>Landscape.*?Home\<\/title\>/i;
export const APP_URL_REGEX = /\/apps\/[a-z]+?\//i;
export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;

export async function asyncForEach<T>(
  array: Array<T>,
  callback: (element: T, idx?: number, ary?: Array<T>) => Promise<void>
) {
  await Promise.all(array.map((e, i) => callback(e, i, array)));
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
