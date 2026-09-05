import { describe, expect, it } from 'vitest';

import {
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
