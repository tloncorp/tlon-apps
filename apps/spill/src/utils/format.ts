import {differenceInDays, endOfToday, format} from 'date-fns';
import {useMemo} from 'react';

export function makePrettyDayAndDateAndTime(date: Date) {
  const fullDate = format(date.getTime(), 'M/d/yy');
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

export function makePrettyDayAndTime(date: Date) {
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

export function formatTime(time?: Date | number | null) {
  if (!time) {
    return null;
  }

  const timeDisplay = makePrettyDayAndDateAndTime(new Date(time));

  return (
    timeDisplay &&
    (timeDisplay.diff >= 8
      ? timeDisplay.fullDate
      : timeDisplay.diff === 0
      ? timeDisplay.time
      : timeDisplay.day)
  );
}

export function useFormattedTime(time?: number | null) {
  return useMemo(() => {
    return time ? formatTime(time) : null;
  }, [time]);
}

export function capitalize(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function pluralize(
  count: number,
  input: string,
  pluralForm = `${input}s`,
) {
  return count === 1 ? input : pluralForm;
}
