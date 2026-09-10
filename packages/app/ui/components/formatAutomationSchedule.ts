import type {
  StewardAutomationSchedule,
  StewardAutomationTask,
} from '@tloncorp/api/urbit';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function numberInRange(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return number >= minimum && number <= maximum ? number : undefined;
}

function formatTime(hour: number, minute: number) {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function ordinal(value: number) {
  const lastTwoDigits = value % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function normalizeDay(value: number) {
  return value === 7 ? 0 : value;
}

function parseDaysOfWeek(field: string) {
  if (field === '1-5') return 'Weekdays';

  const days = field
    .split(',')
    .map((part) => numberInRange(part, 0, 7))
    .filter((day): day is number => day !== undefined)
    .map(normalizeDay);

  if (days.length !== field.split(',').length) return undefined;
  const uniqueDays = [...new Set(days)].sort();
  if (uniqueDays.length === 2 && uniqueDays[0] === 0 && uniqueDays[1] === 6) {
    return 'Weekends';
  }
  if (uniqueDays.length === 1) return `${DAY_NAMES[uniqueDays[0]]}s`;
  if (uniqueDays.length === 0) return undefined;

  const names = uniqueDays.map((day) => DAY_NAMES[day]);
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}s`;
}

export function formatCronSchedule(expression?: string) {
  if (!expression) return 'Custom schedule';

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return 'Custom schedule';

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] =
    fields;
  const minute = numberInRange(minuteField, 0, 59);
  const hour = numberInRange(hourField, 0, 23);

  if (
    minute !== undefined &&
    hour !== undefined &&
    dayOfMonthField === '*' &&
    monthField === '*'
  ) {
    const time = formatTime(hour, minute);
    if (dayOfWeekField === '*') {
      return `Daily at ${time}`;
    }
    const days = parseDaysOfWeek(dayOfWeekField);
    if (days) return `${days} at ${time}`;
  }

  if (minute !== undefined && hour !== undefined && dayOfWeekField === '*') {
    const dayOfMonth = numberInRange(dayOfMonthField, 1, 31);
    if (dayOfMonth !== undefined && monthField === '*') {
      return `Monthly on the ${ordinal(dayOfMonth)} at ${formatTime(hour, minute)}`;
    }

    const month = numberInRange(monthField, 1, 12);
    if (dayOfMonth !== undefined && month !== undefined) {
      return `Yearly on ${MONTH_NAMES[month - 1]} ${ordinal(dayOfMonth)} at ${formatTime(hour, minute)}`;
    }
  }

  if (
    minuteField === '*' &&
    hourField === '*' &&
    dayOfMonthField === '*' &&
    monthField === '*' &&
    dayOfWeekField === '*'
  ) {
    return 'Every minute';
  }

  const minuteInterval = /^\*\/(\d+)$/.exec(minuteField)?.[1];
  if (
    minuteInterval &&
    hourField === '*' &&
    dayOfMonthField === '*' &&
    monthField === '*' &&
    dayOfWeekField === '*'
  ) {
    const interval = numberInRange(minuteInterval, 1, 59);
    if (interval) {
      return `Every ${interval} ${interval === 1 ? 'minute' : 'minutes'}`;
    }
  }

  if (
    minute !== undefined &&
    hourField === '*' &&
    dayOfMonthField === '*' &&
    monthField === '*' &&
    dayOfWeekField === '*'
  ) {
    return `Every hour at :${String(minute).padStart(2, '0')}`;
  }

  const hourInterval = /^\*\/(\d+)$/.exec(hourField)?.[1];
  if (
    minute !== undefined &&
    hourInterval &&
    dayOfMonthField === '*' &&
    monthField === '*' &&
    dayOfWeekField === '*'
  ) {
    const interval = numberInRange(hourInterval, 1, 23);
    if (interval) {
      return `Every ${interval} ${interval === 1 ? 'hour' : 'hours'} at :${String(minute).padStart(2, '0')}`;
    }
  }

  return 'Custom schedule';
}

function formatEverySchedule(schedule: StewardAutomationSchedule) {
  if (schedule.kind !== 'every' || !schedule.everyMs) {
    return 'Repeating schedule';
  }
  const hours = schedule.everyMs / (60 * 60 * 1000);
  if (Number.isInteger(hours) && hours >= 1) {
    return `Every ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  const minutes = Math.round(schedule.everyMs / (60 * 1000));
  return `Every ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export function formatAutomationSchedule(task: StewardAutomationTask) {
  const schedule = task.schedule;
  if (!schedule) return 'Schedule unavailable';
  if (schedule.kind === 'cron') {
    return formatCronSchedule(schedule.expr);
  }
  if (schedule.kind === 'at') {
    return schedule.at
      ? `Once · ${new Date(schedule.at).toLocaleString()}`
      : 'One-time schedule';
  }
  return formatEverySchedule(schedule);
}
