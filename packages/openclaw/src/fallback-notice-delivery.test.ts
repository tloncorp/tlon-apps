import { describe, expect, it } from 'vitest';

import {
  TLON_FALLBACK_NOTICE_SUPPRESSION_REASON,
  suppressTlonFallbackNotice,
} from './fallback-notice-delivery.js';

const context = { channelId: 'tlon' };

describe('suppressTlonFallbackNotice', () => {
  it('suppresses an OpenClaw fallback transition on Tlon', () => {
    expect(
      suppressTlonFallbackNotice(
        {
          payload: { text: 'Model routing status', isFallbackNotice: true },
          kind: 'final',
          channel: 'tlon',
        },
        context
      )
    ).toEqual({
      cancel: true,
      reason: TLON_FALLBACK_NOTICE_SUPPRESSION_REASON,
    });
  });

  it('uses the resolved hook context when the event omits its channel', () => {
    expect(
      suppressTlonFallbackNotice(
        { payload: { isFallbackNotice: true }, kind: 'final' },
        context
      )
    ).toEqual({
      cancel: true,
      reason: TLON_FALLBACK_NOTICE_SUPPRESSION_REASON,
    });
  });

  it('preserves a terminal provider error', () => {
    expect(
      suppressTlonFallbackNotice(
        {
          payload: {
            text: 'The selected model is unavailable.',
            isError: true,
          },
          kind: 'final',
          channel: 'tlon',
        },
        context
      )
    ).toBeUndefined();
  });

  it('preserves other OpenClaw status notices', () => {
    expect(
      suppressTlonFallbackNotice(
        {
          payload: {
            text: 'Compacting conversation context',
            isStatusNotice: true,
          },
          kind: 'final',
          channel: 'tlon',
        },
        context
      )
    ).toBeUndefined();
  });

  it('does not change another channel policy', () => {
    expect(
      suppressTlonFallbackNotice(
        {
          payload: { isFallbackNotice: true },
          kind: 'final',
          channel: 'webchat',
        },
        context
      )
    ).toBeUndefined();
  });
});
