import { describe, expect, it, jest } from '@jest/globals';
import type { Notification } from 'expo-notifications';

import {
  DM_TAP_SKEW_TOLERANCE_MS,
  DM_TAP_WINDOW_MS,
  extractDmTapTelemetry,
  readRawPayload,
  safeParseActivityEvent,
} from '../lib/dmTapTelemetry';

const SIG_RE = /^~[a-z-]+$/;

function makeDmPostJson(opts: { id?: string; whom?: object }): string {
  const id =
    opts.id ??
    '~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.882.809.306.892.730.368.000';
  const whom = opts.whom ?? { ship: '~zod' };
  return JSON.stringify({
    event: {
      notified: true,
      'dm-post': {
        key: { id, time: '170.141.184.506.402.927.288.078.336.000.000' },
        whom,
        content: [],
        mention: false,
      },
    },
  });
}

function rawPayloadWithDmPost(opts: {
  id?: string;
  whom?: object;
  uid?: string | undefined;
}): Record<string, unknown> {
  return {
    activityEventJsonString: makeDmPostJson({ id: opts.id, whom: opts.whom }),
    ...(opts.uid !== undefined ? { uid: opts.uid } : {}),
  };
}

describe('safeParseActivityEvent', () => {
  it('returns missing when activityEventJsonString is absent', () => {
    expect(safeParseActivityEvent({})).toEqual({
      ok: false,
      error: 'missing',
    });
  });

  it('returns missing when activityEventJsonString is not a string', () => {
    expect(safeParseActivityEvent({ activityEventJsonString: 123 })).toEqual({
      ok: false,
      error: 'missing',
    });
  });

  it('returns malformed for invalid JSON', () => {
    expect(
      safeParseActivityEvent({ activityEventJsonString: '{not json' })
    ).toEqual({ ok: false, error: 'malformed' });
  });

  describe('parseable but malformed root wrapper', () => {
    const cases = [
      '"null"',
      'null',
      '"a string"',
      '[1,2,3]',
      '{}',
      '{"event": null}',
      '{"event": "not-an-object"}',
      '{"event": [1,2,3]}',
    ];
    for (const c of cases) {
      it(`rejects ${c}`, () => {
        const r = safeParseActivityEvent({ activityEventJsonString: c });
        expect(r).toEqual({ ok: false, error: 'malformed' });
      });
    }
  });

  it('returns ok for a well-formed event wrapper', () => {
    const payload = makeDmPostJson({});
    const r = safeParseActivityEvent({ activityEventJsonString: payload });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.event['dm-post']).toBeDefined();
    }
  });
});

describe('extractDmTapTelemetry', () => {
  it('returns null when parsed activity is not ok', () => {
    expect(
      extractDmTapTelemetry({ ok: false, error: 'missing' }, {}, '~zod')
    ).toBeNull();
    expect(
      extractDmTapTelemetry({ ok: false, error: 'malformed' }, {}, '~zod')
    ).toBeNull();
  });

  it('returns telemetry for a well-formed dm-post', () => {
    const rawPayload = rawPayloadWithDmPost({ uid: '0v1.abcde' });
    const parsed = safeParseActivityEvent(rawPayload);
    const t = extractDmTapTelemetry(parsed, rawPayload, '~zod');
    expect(t).not.toBeNull();
    if (!t) throw new Error('expected telemetry');
    expect(t.ownerShip).toMatch(SIG_RE);
    expect(t.ownerShip).toBe('~zod');
    expect(t.senderShip).toMatch(SIG_RE);
    expect(t.attributionSource).toBe('notification_tap');
    expect(t.channel).toBe('tlon');
    expect(['ios', 'android']).toContain(t.platform);
    expect(typeof t.messageSentAtMs).toBe('number');
    expect(typeof t.tappedAtMs).toBe('number');
    expect(typeof t.delayMs).toBe('number');
    expect(t.notificationUid).toBe('0v1.abcde');
    expect(typeof t.withinAttributionWindow).toBe('boolean');
  });

  it('emits notificationUid null when uid is absent', () => {
    const rawPayload = rawPayloadWithDmPost({});
    const parsed = safeParseActivityEvent(rawPayload);
    const t = extractDmTapTelemetry(parsed, rawPayload, '~zod');
    expect(t).not.toBeNull();
    if (t) expect(t.notificationUid).toBeNull();
  });

  it('accepts club DMs (does not gate on ship whom)', () => {
    const rawPayload = rawPayloadWithDmPost({
      whom: { club: 'abc-def-ghi-jkl' },
    });
    const parsed = safeParseActivityEvent(rawPayload);
    const t = extractDmTapTelemetry(parsed, rawPayload, '~zod');
    expect(t).not.toBeNull();
  });

  it('returns null for non-dm-post events', () => {
    const payload = JSON.stringify({
      event: {
        notified: true,
        post: {
          key: {
            id: '~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.882.809.306.892.730.368.000',
            time: '170.141.184.506.402.927.288.078.336.000.000',
          },
          group: 'group',
          channel: 'channel',
          content: [],
          mention: false,
        },
      },
    });
    const rawPayload = { activityEventJsonString: payload };
    const parsed = safeParseActivityEvent(rawPayload);
    const t = extractDmTapTelemetry(parsed, rawPayload, '~zod');
    expect(t).toBeNull();
  });

  describe('parseable-but-malformed dm-post returns null', () => {
    const shapes: Array<{ label: string; rawEvent: unknown }> = [
      { label: 'dm-post is null', rawEvent: { 'dm-post': null } },
      { label: 'dm-post is empty', rawEvent: { 'dm-post': {} } },
      {
        label: 'key is null',
        rawEvent: { 'dm-post': { key: null } },
      },
      {
        label: 'key is empty',
        rawEvent: { 'dm-post': { key: {} } },
      },
      {
        label: 'empty id',
        rawEvent: { 'dm-post': { key: { id: '' } } },
      },
      {
        label: 'unparseable id',
        rawEvent: {
          'dm-post': { key: { id: 'not-a-valid-urbit-id' } },
        },
      },
    ];

    for (const { label, rawEvent } of shapes) {
      it(label, () => {
        const rawPayload = {
          activityEventJsonString: JSON.stringify({ event: rawEvent }),
        };
        const parsed = safeParseActivityEvent(rawPayload);
        // parsedActivity is ok=true for all of these (the wrapper is valid)
        const t = extractDmTapTelemetry(parsed, rawPayload, '~zod');
        expect(t).toBeNull();
      });
    }
  });

  describe('withinAttributionWindow boundaries', () => {
    const baseRawPayload = rawPayloadWithDmPost({});
    const baseParsed = safeParseActivityEvent(baseRawPayload);
    const baseT = extractDmTapTelemetry(baseParsed, baseRawPayload, '~zod');
    if (!baseT) throw new Error('expected telemetry');
    const msgSentAt = baseT.messageSentAtMs;

    it('10 min after send is true', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt + 10 * 60 * 1000
      );
      expect(t?.withinAttributionWindow).toBe(true);
    });

    it('7 hours after send is false', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt + 7 * 60 * 60 * 1000
      );
      expect(t?.withinAttributionWindow).toBe(false);
    });

    it('exactly 6h after send is true (boundary)', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt + DM_TAP_WINDOW_MS
      );
      expect(t?.withinAttributionWindow).toBe(true);
    });

    it('6h+1ms after send is false', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt + DM_TAP_WINDOW_MS + 1
      );
      expect(t?.withinAttributionWindow).toBe(false);
    });

    it('2 min in the future is true (inside skew tolerance)', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt - 2 * 60 * 1000
      );
      expect(t?.withinAttributionWindow).toBe(true);
    });

    it('10 min in the future is false (outside skew tolerance)', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt - 10 * 60 * 1000
      );
      expect(t?.withinAttributionWindow).toBe(false);
    });

    it('delayMs === -300000 is true (exact negative boundary)', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt - DM_TAP_SKEW_TOLERANCE_MS
      );
      expect(t?.withinAttributionWindow).toBe(true);
    });

    it('delayMs === -300001 is false', () => {
      const t = extractDmTapTelemetry(
        baseParsed,
        baseRawPayload,
        '~zod',
        msgSentAt - DM_TAP_SKEW_TOLERANCE_MS - 1
      );
      expect(t?.withinAttributionWindow).toBe(false);
    });
  });

  it('does not include canonical nudge strings as property values', () => {
    const rawPayload = rawPayloadWithDmPost({});
    const parsed = safeParseActivityEvent(rawPayload);
    const t = extractDmTapTelemetry(parsed, rawPayload, '~zod');
    expect(t).not.toBeNull();
    if (!t) return;
    const NUDGE_FRAGMENTS = [
      "haven't logged in",
      'just say hi',
      'check out the latest',
    ];
    for (const value of Object.values(t)) {
      if (typeof value !== 'string') continue;
      for (const fragment of NUDGE_FRAGMENTS) {
        expect(value).not.toContain(fragment);
      }
    }
  });
});

describe('readRawPayload', () => {
  function notif(payload: unknown, push = true): Notification {
    // Construct a synthetic notification shape that matches Expo's runtime
    // (the type is loose enough that we can supply a partial).
    return {
      request: {
        identifier: 'x',
        content: {
          title: null,
          subtitle: null,
          body: null,
          data: push ? {} : (payload as Record<string, unknown>),
          sound: null,
        } as unknown as Notification['request']['content'],
        trigger: push
          ? ({
              type: 'push',
              payload,
            } as unknown as Notification['request']['trigger'])
          : (null as unknown as Notification['request']['trigger']),
      },
      date: 0,
    } as unknown as Notification;
  }

  it('coerces null payload to {}', () => {
    const out = readRawPayload(notif(null));
    expect(out).toEqual({});
  });

  it('coerces array payload to {}', () => {
    const out = readRawPayload(notif([1, 2, 3]));
    expect(out).toEqual({});
  });

  it('coerces string payload to {}', () => {
    const out = readRawPayload(notif('a string'));
    expect(out).toEqual({});
  });

  it('coerces number payload to {}', () => {
    const out = readRawPayload(notif(42));
    expect(out).toEqual({});
  });

  it('coerces undefined payload to {}', () => {
    const out = readRawPayload(notif(undefined));
    expect(out).toEqual({});
  });

  it('returns the object payload when valid', () => {
    const out = readRawPayload(notif({ activityEventJsonString: 'x' }));
    expect(out).toEqual({ activityEventJsonString: 'x' });
  });
});

describe('readRawPayload — iOS local notification fallback', () => {
  const Platform = (
    jest.requireActual('react-native') as { Platform: { OS: string } }
  ).Platform;
  // We can't easily mock Platform.OS per-test for jest-expo; document the iOS
  // local-notification path with a test that exercises the same source code.
  // The hook & helper read from content.data when trigger.type !== 'push'.
  it('on iOS, reads content.data when trigger is null', () => {
    if (Platform.OS !== 'ios') {
      // Not running under iOS test target; skip.
      return;
    }
    const localNotif = {
      request: {
        identifier: 'x',
        content: {
          title: null,
          subtitle: null,
          body: null,
          data: { type: 'contactMatched', contactId: '~zod' },
          sound: null,
        } as unknown as Notification['request']['content'],
        trigger: null as unknown as Notification['request']['trigger'],
      },
      date: 0,
    } as unknown as Notification;
    const out = readRawPayload(localNotif);
    expect(out).toEqual({ type: 'contactMatched', contactId: '~zod' });
  });
});
