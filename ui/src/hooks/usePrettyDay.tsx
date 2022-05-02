import { format, differenceInDays } from 'date-fns';

export default function usePrettyDay(date: Date) {
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
