import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-localization', () => ({
  getCalendars: () => [{ timeZone: 'America/Los_Angeles' }],
  getLocales: () => [{ languageTag: 'en-US' }],
}));

import { getClientDateTimeContext } from './clientDateTimeContext';

describe('getClientDateTimeContext', () => {
  it('uses the client device timezone and locale', () => {
    expect(getClientDateTimeContext()).toEqual({
      timezone: 'America/Los_Angeles',
      locale: 'en-US',
    });
  });
});
