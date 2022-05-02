import { format, differenceInDays } from 'date-fns';

export default function usePrettyDayAndDateAndTime(date: Date) {
  const diff = differenceInDays(new Date(), date);
  const time = format(date, 'HH:mm');
  const fullDate = `${format(date, 'LLLL')} ${format(date, 'do')}, ${format(
    date,
    'yyyy'
  )}`;
  switch (true) {
    case diff === 0:
      return `Today • ${fullDate} • ${time}`;
    case diff === 1:
      return `Yesterday • ${fullDate} • ${time}`;
    case diff > 1 && diff < 8:
      return `${format(date, 'cccc')} • ${fullDate} • ${time}`;
    default:
      return `${fullDate} • ${time}`;
  }
}
