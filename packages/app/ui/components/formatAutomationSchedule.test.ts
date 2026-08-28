import { describe, expect, it } from 'vitest';

import {
  automationScheduleFields,
  formatAutomationSchedule,
  formatCronSchedule,
} from './formatAutomationSchedule';

describe('formatCronSchedule', () => {
  it.each([
    ['0 7 * * 1-5', 'Weekdays at 7:00 AM'],
    ['0 2 * * *', 'Daily at 2:00 AM'],
    ['0 9 * * 1', 'Mondays at 9:00 AM'],
    ['0 10 1 * *', 'Monthly on the 1st at 10:00 AM'],
    ['30 8 15 3 *', 'Yearly on March 15th at 8:30 AM'],
    ['*/15 * * * *', 'Every 15 minutes'],
    ['30 * * * *', 'Every hour at :30'],
  ])('describes %s', (expression, expected) => {
    expect(formatCronSchedule(expression)).toBe(expected);
  });

  it('does not expose expressions it cannot accurately describe', () => {
    expect(formatCronSchedule('0 9 L * *')).toBe('Custom schedule');
    expect(formatCronSchedule('not a cron expression')).toBe('Custom schedule');
  });
});

describe('formatAutomationSchedule', () => {
  it('preserves readable interval schedules', () => {
    expect(
      formatAutomationSchedule({
        schedule: { kind: 'every', everyMs: 4 * 60 * 60 * 1000 },
      })
    ).toBe('Every 4 hours');
  });
});

describe('automationScheduleFields', () => {
  const cron = (expr: string) => ({
    schedule: { kind: 'cron' as const, expr },
  });

  it('maps a daily cron to every day and its real time', () => {
    expect(automationScheduleFields(cron('0 9 * * *'))).toEqual({
      repeat: 'Daily',
      selectedDays: [0, 1, 2, 3, 4, 5, 6],
      timeLabel: '9:00 AM',
    });
  });

  it('expands a weekday range', () => {
    expect(automationScheduleFields(cron('30 7 * * 1-5'))).toEqual({
      repeat: 'Weekly',
      selectedDays: [1, 2, 3, 4, 5],
      timeLabel: '7:30 AM',
    });
  });

  it('normalizes day 7 to Sunday and dedupes a list', () => {
    expect(automationScheduleFields(cron('0 18 * * 7,0,3'))).toEqual({
      repeat: 'Weekly',
      selectedDays: [0, 3],
      timeLabel: '6:00 PM',
    });
  });

  it.each([
    ['0 10 1 * *', 'Monthly'],
    ['30 8 15 3 *', 'Yearly'],
  ])('maps %s to %s with no weekdays', (expr, repeat) => {
    expect(automationScheduleFields(cron(expr))).toEqual({
      repeat,
      selectedDays: [],
      timeLabel: expr.startsWith('0 10') ? '10:00 AM' : '8:30 AM',
    });
  });

  it.each([
    ['*/15 * * * *'],
    ['30 * * * *'],
    ['0 9 * *'],
    ['bad expr here now'],
  ])('returns undefined for %s, which the editor cannot represent', (expr) => {
    expect(automationScheduleFields(cron(expr))).toBeUndefined();
  });

  it.each([
    [{ kind: 'every' as const, everyMs: 14_400_000 }],
    [{ kind: 'at' as const, at: 1_787_672_963_105 }],
  ])('returns undefined for non-cron schedule %o', (schedule) => {
    expect(automationScheduleFields({ schedule })).toBeUndefined();
  });

  it('returns undefined when there is no schedule at all', () => {
    expect(automationScheduleFields({})).toBeUndefined();
  });
});
