import { describe, expect, it, vi } from 'vitest';

import {
  APPROVAL_TTL_MS,
  DM_INVITE_PREVIEW,
  applySettingsUpdate,
  createSettingsManager,
  parseSettingsResponse,
} from './settings.js';

describe('Settings: parseSettingsResponse', () => {
  it('parses lastOwnerMessageAt as number', () => {
    const result = parseSettingsResponse({
      tlon: { lastOwnerMessageAt: 1700000000000 },
    });
    expect(result.lastOwnerMessageAt).toBe(1700000000000);
  });

  it('ignores lastOwnerMessageAt when not a number', () => {
    expect(
      parseSettingsResponse({ tlon: { lastOwnerMessageAt: 'not-a-number' } })
        .lastOwnerMessageAt
    ).toBeUndefined();
    expect(
      parseSettingsResponse({ tlon: { lastOwnerMessageAt: true } })
        .lastOwnerMessageAt
    ).toBeUndefined();
    expect(
      parseSettingsResponse({ tlon: { lastOwnerMessageAt: null } })
        .lastOwnerMessageAt
    ).toBeUndefined();
    expect(
      parseSettingsResponse({ tlon: { lastOwnerMessageAt: { nested: 1 } } })
        .lastOwnerMessageAt
    ).toBeUndefined();
  });

  it('handles missing lastOwnerMessageAt gracefully', () => {
    const result = parseSettingsResponse({ tlon: {} });
    expect(result.lastOwnerMessageAt).toBeUndefined();
  });

  it('returns empty object for empty/missing input', () => {
    expect(parseSettingsResponse(null)).toEqual({});
    expect(parseSettingsResponse(undefined)).toEqual({});
    expect(parseSettingsResponse({})).toEqual({});
  });

  it('parses lastOwnerMessageAt alongside other fields', () => {
    const result = parseSettingsResponse({
      tlon: {
        dmAllowlist: ['~zod'],
        ownerShip: '~sampel-palnet',
        lastOwnerMessageAt: 1700000000000,
      },
    });
    expect(result.dmAllowlist).toEqual(['~zod']);
    expect(result.ownerShip).toBe('~sampel-palnet');
    expect(result.lastOwnerMessageAt).toBe(1700000000000);
  });

  it('parses lastNudgeStage when it is 1, 2, or 3', () => {
    expect(
      parseSettingsResponse({ tlon: { lastNudgeStage: 1 } }).lastNudgeStage
    ).toBe(1);
    expect(
      parseSettingsResponse({ tlon: { lastNudgeStage: '2' } }).lastNudgeStage
    ).toBe(2);
    expect(
      parseSettingsResponse({ tlon: { lastNudgeStage: 3 } }).lastNudgeStage
    ).toBe(3);
  });

  it('ignores invalid lastNudgeStage values', () => {
    expect(
      parseSettingsResponse({ tlon: { lastNudgeStage: 0 } }).lastNudgeStage
    ).toBeUndefined();
    expect(
      parseSettingsResponse({ tlon: { lastNudgeStage: 4 } }).lastNudgeStage
    ).toBeUndefined();
    expect(
      parseSettingsResponse({ tlon: { lastNudgeStage: 'not-a-stage' } })
        .lastNudgeStage
    ).toBeUndefined();
  });

  describe('parsePendingNudge', () => {
    it('parses the new shape without LLM fields', () => {
      const json = JSON.stringify({
        sentAt: 123,
        stage: 2,
        ownerShip: '~zod',
        accountId: 'default',
        content: 'hey',
      });
      const result = parseSettingsResponse({ tlon: { pendingNudge: json } });
      expect(result.pendingNudge).toEqual({
        sentAt: 123,
        stage: 2,
        ownerShip: '~zod',
        accountId: 'default',
        content: 'hey',
      });
    });

    it('tolerates legacy records with sessionKey/provider/model', () => {
      const json = JSON.stringify({
        sentAt: 123,
        stage: 1,
        ownerShip: '~zod',
        accountId: 'default',
        sessionKey: 'old-sess',
        provider: 'anthropic',
        model: 'claude-3',
      });
      const result = parseSettingsResponse({ tlon: { pendingNudge: json } });
      expect(result.pendingNudge).toEqual({
        sentAt: 123,
        stage: 1,
        ownerShip: '~zod',
        accountId: 'default',
      });
      expect(result.pendingNudge).not.toHaveProperty('sessionKey');
      expect(result.pendingNudge).not.toHaveProperty('provider');
      expect(result.pendingNudge).not.toHaveProperty('model');
    });

    it('tolerates missing content field', () => {
      const json = JSON.stringify({
        sentAt: 123,
        stage: 1,
        ownerShip: '~zod',
        accountId: 'default',
      });
      const result = parseSettingsResponse({ tlon: { pendingNudge: json } });
      expect(result.pendingNudge?.content).toBeUndefined();
    });
  });

  describe('nudgeActiveHours*', () => {
    it('parses all three keys as strings', () => {
      const result = parseSettingsResponse({
        tlon: {
          nudgeActiveHoursStart: '09:00',
          nudgeActiveHoursEnd: '21:00',
          nudgeActiveHoursTimezone: 'America/New_York',
        },
      });
      expect(result.nudgeActiveHoursStart).toBe('09:00');
      expect(result.nudgeActiveHoursEnd).toBe('21:00');
      expect(result.nudgeActiveHoursTimezone).toBe('America/New_York');
    });

    it('ignores non-string values', () => {
      const result = parseSettingsResponse({
        tlon: { nudgeActiveHoursStart: 900, nudgeActiveHoursEnd: null },
      });
      expect(result.nudgeActiveHoursStart).toBeUndefined();
      expect(result.nudgeActiveHoursEnd).toBeUndefined();
    });
  });

  describe('pendingApprovals', () => {
    it('drops expired approvals when parsing settings', () => {
      const now = Date.now();
      const result = parseSettingsResponse({
        tlon: {
          pendingApprovals: JSON.stringify([
            {
              id: 'expired',
              type: 'channel',
              requestingShip: '~old',
              timestamp: now - APPROVAL_TTL_MS - 1,
            },
            {
              id: 'fresh',
              type: 'channel',
              requestingShip: '~new',
              timestamp: now,
              originalMessage: {
                messageId: '170.000',
                messageText: 'hi',
                messageContent: [{ inline: ['hi'] }],
                timestamp: now,
              },
            },
          ]),
        },
      });

      expect(result.pendingApprovals?.map((approval) => approval.id)).toEqual([
        'fresh',
      ]);
    });

    it('drops message approvals that cannot replay an original message', () => {
      const now = Date.now();
      const result = parseSettingsResponse({
        tlon: {
          pendingApprovals: JSON.stringify([
            {
              id: 'stale-channel',
              type: 'channel',
              requestingShip: '~old',
              timestamp: now,
            },
            {
              id: 'dm-invite',
              type: 'dm',
              requestingShip: '~new',
              messagePreview: DM_INVITE_PREVIEW,
              timestamp: now,
            },
            {
              id: 'fresh-channel',
              type: 'channel',
              requestingShip: '~new',
              timestamp: now,
              originalMessage: {
                messageId: '170.000',
                messageText: 'hi',
                messageContent: [{ inline: ['hi'] }],
                timestamp: now,
              },
            },
          ]),
        },
      });

      expect(result.pendingApprovals?.map((approval) => approval.id)).toEqual([
        'dm-invite',
        'fresh-channel',
      ]);
    });
  });
});

describe('Settings: autoDiscoverChannels', () => {
  it('parses autoDiscoverChannels (the key the monitor consumes)', () => {
    expect(
      parseSettingsResponse({ tlon: { autoDiscoverChannels: true } })
        .autoDiscoverChannels
    ).toBe(true);
    expect(
      parseSettingsResponse({ tlon: { autoDiscoverChannels: false } })
        .autoDiscoverChannels
    ).toBe(false);
    expect(
      parseSettingsResponse({ tlon: { autoDiscoverChannels: 'nope' } })
        .autoDiscoverChannels
    ).toBeUndefined();
  });

  it('hot-updates autoDiscoverChannels', () => {
    expect(
      applySettingsUpdate({}, 'autoDiscoverChannels', true).autoDiscoverChannels
    ).toBe(true);
    expect(
      applySettingsUpdate(
        { autoDiscoverChannels: true },
        'autoDiscoverChannels',
        false
      ).autoDiscoverChannels
    ).toBe(false);
  });
});

describe('Settings: applySettingsUpdate', () => {
  it('updates lastOwnerMessageAt with number value', () => {
    const result = applySettingsUpdate({}, 'lastOwnerMessageAt', 1700000000000);
    expect(result.lastOwnerMessageAt).toBe(1700000000000);
  });

  it('clears lastOwnerMessageAt with non-number value', () => {
    const base = { lastOwnerMessageAt: 1700000000000 };
    expect(
      applySettingsUpdate(base, 'lastOwnerMessageAt', 'string')
        .lastOwnerMessageAt
    ).toBeUndefined();
    expect(
      applySettingsUpdate(base, 'lastOwnerMessageAt', null).lastOwnerMessageAt
    ).toBeUndefined();
    expect(
      applySettingsUpdate(base, 'lastOwnerMessageAt', undefined)
        .lastOwnerMessageAt
    ).toBeUndefined();
  });

  it('preserves other fields when updating lastOwnerMessageAt', () => {
    const base = { dmAllowlist: ['~zod'], ownerShip: '~sampel-palnet' };
    const result = applySettingsUpdate(
      base,
      'lastOwnerMessageAt',
      1700000000000
    );
    expect(result.dmAllowlist).toEqual(['~zod']);
    expect(result.ownerShip).toBe('~sampel-palnet');
    expect(result.lastOwnerMessageAt).toBe(1700000000000);
  });

  it('does not modify original object', () => {
    const base = { lastOwnerMessageAt: 1700000000000 };
    const result = applySettingsUpdate(
      base,
      'lastOwnerMessageAt',
      1800000000000
    );
    expect(base.lastOwnerMessageAt).toBe(1700000000000);
    expect(result.lastOwnerMessageAt).toBe(1800000000000);
  });

  it('updates lastNudgeStage with valid values only', () => {
    expect(applySettingsUpdate({}, 'lastNudgeStage', 1).lastNudgeStage).toBe(1);
    expect(applySettingsUpdate({}, 'lastNudgeStage', '2').lastNudgeStage).toBe(
      2
    );
    expect(
      applySettingsUpdate({}, 'lastNudgeStage', 4).lastNudgeStage
    ).toBeUndefined();
  });

  it('updates nudgeActiveHours* keys with string values', () => {
    expect(
      applySettingsUpdate({}, 'nudgeActiveHoursStart', '09:00')
        .nudgeActiveHoursStart
    ).toBe('09:00');
    expect(
      applySettingsUpdate({}, 'nudgeActiveHoursEnd', '21:00')
        .nudgeActiveHoursEnd
    ).toBe('21:00');
    expect(
      applySettingsUpdate({}, 'nudgeActiveHoursTimezone', 'UTC')
        .nudgeActiveHoursTimezone
    ).toBe('UTC');
  });

  it('clears nudgeActiveHours* keys when value is not a string', () => {
    const base = { nudgeActiveHoursStart: '09:00' };
    expect(
      applySettingsUpdate(base, 'nudgeActiveHoursStart', 42)
        .nudgeActiveHoursStart
    ).toBeUndefined();
  });

  it('updates ownerListenEnabled with boolean and clears on non-boolean', () => {
    expect(
      applySettingsUpdate({}, 'ownerListenEnabled', true).ownerListenEnabled
    ).toBe(true);
    expect(
      applySettingsUpdate({}, 'ownerListenEnabled', false).ownerListenEnabled
    ).toBe(false);
    expect(
      applySettingsUpdate(
        { ownerListenEnabled: true },
        'ownerListenEnabled',
        'yes'
      ).ownerListenEnabled
    ).toBeUndefined();
    expect(
      applySettingsUpdate(
        { ownerListenEnabled: true },
        'ownerListenEnabled',
        null
      ).ownerListenEnabled
    ).toBeUndefined();
  });

  it('updates ownerListenDisabledChannels with array and filters non-strings', () => {
    expect(
      applySettingsUpdate({}, 'ownerListenDisabledChannels', [
        'chat/~zod/foo',
        'chat/~bus/bar',
      ]).ownerListenDisabledChannels
    ).toEqual(['chat/~zod/foo', 'chat/~bus/bar']);
    expect(
      applySettingsUpdate({}, 'ownerListenDisabledChannels', [
        'chat/~zod/foo',
        42,
        null,
      ]).ownerListenDisabledChannels
    ).toEqual(['chat/~zod/foo']);
    expect(
      applySettingsUpdate(
        { ownerListenDisabledChannels: ['chat/~zod/foo'] },
        'ownerListenDisabledChannels',
        'not-an-array'
      ).ownerListenDisabledChannels
    ).toBeUndefined();
  });

  it('drops expired pendingApprovals updates', () => {
    const now = Date.now();
    const result = applySettingsUpdate(
      {},
      'pendingApprovals',
      JSON.stringify([
        {
          id: 'expired',
          type: 'dm',
          requestingShip: '~old',
          timestamp: now - APPROVAL_TTL_MS - 1,
        },
        {
          id: 'fresh',
          type: 'dm',
          requestingShip: '~new',
          timestamp: now,
          originalMessage: {
            messageId: '170.000',
            messageText: 'hi',
            messageContent: [{ inline: ['hi'] }],
            timestamp: now,
          },
        },
      ])
    );

    expect(result.pendingApprovals?.map((approval) => approval.id)).toEqual([
      'fresh',
    ]);
  });
});

describe('Settings: createSettingsManager.load', () => {
  it('preserves the last good snapshot when a later load fails', async () => {
    let callCount = 0;
    const manager = createSettingsManager(
      {
        scry: async () => {
          callCount += 1;
          if (callCount === 1) {
            return {
              all: {
                moltbot: {
                  tlon: {
                    ownerShip: '~zod',
                    dmAllowlist: ['~nec'],
                  },
                },
              },
            };
          }
          throw new Error('temporary outage');
        },
      } as never,
      { log: () => undefined }
    );

    await expect(manager.load()).resolves.toEqual({
      settings: { ownerShip: '~zod', dmAllowlist: ['~nec'] },
      fresh: true,
    });
    await expect(manager.load()).resolves.toEqual({
      settings: { ownerShip: '~zod', dmAllowlist: ['~nec'] },
      fresh: false,
    });
    expect(manager.current).toEqual({
      ownerShip: '~zod',
      dmAllowlist: ['~nec'],
    });
  });

  it('returns an empty snapshot on the first load failure', async () => {
    const log = vi.fn();
    const error = vi.fn();
    const manager = createSettingsManager(
      {
        scry: async () => {
          throw new Error('desk unavailable');
        },
      } as never,
      { log, error }
    );

    await expect(manager.load()).resolves.toEqual({
      settings: {},
      fresh: false,
    });
    expect(manager.current).toEqual({});
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      '[settings] Load failed (keeping previous settings): Error: desk unavailable'
    );
  });

  it('logs a compact settings summary without full pending approval messages', async () => {
    const logs: string[] = [];
    const manager = createSettingsManager(
      {
        scry: async () => ({
          all: {
            moltbot: {
              tlon: {
                pendingApprovals: JSON.stringify([
                  {
                    id: 'approval-1',
                    type: 'channel',
                    requestingShip: '~zod',
                    channelNest: 'chat/~zod/general',
                    messagePreview: 'secret preview',
                    originalMessage: {
                      messageId: '170.000',
                      messageText: 'secret full message',
                      messageContent: [{ inline: ['secret content'] }],
                      timestamp: Date.now(),
                    },
                    timestamp: Date.now(),
                  },
                ]),
              },
            },
          },
        }),
      } as never,
      { log: (message) => logs.push(message) }
    );

    await manager.load();
    const loadedLog = logs.find((message) =>
      message.startsWith('[settings] Loaded:')
    );
    expect(loadedLog).toContain('approval-1');
    expect(loadedLog).toContain('~zod');
    expect(loadedLog).not.toContain('secret preview');
    expect(loadedLog).not.toContain('secret full message');
    expect(loadedLog).not.toContain('secret content');
  });

  it('can suppress the snapshot summary for periodic refreshes', async () => {
    const log = vi.fn();
    const manager = createSettingsManager(
      {
        scry: async () => ({
          all: { moltbot: { tlon: { ownerShip: '~zod' } } },
        }),
      } as never,
      { log }
    );

    await manager.load({ logSnapshot: false });

    expect(log).not.toHaveBeenCalled();
    expect(manager.current).toEqual({ ownerShip: '~zod' });
  });
});
