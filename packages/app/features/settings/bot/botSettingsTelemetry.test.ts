import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {
    TlonbotSettingUpdated: 'Tlonbot Setting Updated',
  },
  trackEvent: mocks.trackEvent,
}));

import { trackTlonbotSettingUpdated } from './botSettingsTelemetry';

describe('trackTlonbotSettingUpdated', () => {
  beforeEach(() => {
    mocks.trackEvent.mockClear();
  });

  it('captures the common event with privacy-safe setting properties', () => {
    trackTlonbotSettingUpdated({
      setting: 'zero_data_retention',
      action: 'updated',
      enabled: true,
      provider: 'openrouter',
    });

    expect(mocks.trackEvent).toHaveBeenCalledWith('Tlonbot Setting Updated', {
      surface: 'bot_settings',
      setting: 'zero_data_retention',
      action: 'updated',
      enabled: true,
      provider: 'openrouter',
    });
  });

  it('omits undefined optional properties', () => {
    trackTlonbotSettingUpdated({
      setting: 'connected_service',
      action: 'connected',
      provider: undefined,
    });

    expect(mocks.trackEvent).toHaveBeenCalledWith('Tlonbot Setting Updated', {
      surface: 'bot_settings',
      setting: 'connected_service',
      action: 'connected',
    });
  });

  it('does not fail a successful settings write when analytics throws', () => {
    mocks.trackEvent.mockImplementationOnce(() => {
      throw new Error('analytics unavailable');
    });

    expect(() =>
      trackTlonbotSettingUpdated({
        setting: 'nickname',
        action: 'updated',
      })
    ).not.toThrow();
  });
});
