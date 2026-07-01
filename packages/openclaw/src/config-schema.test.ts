import { describe, expect, it } from 'vitest';

import { TlonAuthorizationSchema, TlonConfigSchema } from './config-schema.js';

describe('Tlon config schema', () => {
  it('accepts channelRules with string keys', () => {
    const parsed = TlonAuthorizationSchema.parse({
      channelRules: {
        'chat/~zod/test': {
          mode: 'open',
          allowedShips: ['~zod'],
        },
      },
    });

    expect(parsed.channelRules?.['chat/~zod/test']?.mode).toBe('open');
  });

  it('accepts accounts with string keys', () => {
    const parsed = TlonConfigSchema.parse({
      accounts: {
        primary: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
        },
      },
    });

    expect(parsed.accounts?.primary?.ship).toBe('~zod');
  });

  it('accepts opt-in telemetry configuration', () => {
    const parsed = TlonConfigSchema.parse({
      telemetry: {
        enabled: true,
        apiKey: 'phc_base',
        host: 'https://us.i.posthog.com',
      },
      accounts: {
        hosted: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          telemetry: {
            enabled: true,
            apiKey: 'phc_account',
          },
        },
      },
    });

    expect(parsed.telemetry?.enabled).toBe(true);
    expect(parsed.accounts?.hosted?.telemetry?.apiKey).toBe('phc_account');
  });

  it('accepts lifecycle timeout configuration', () => {
    const parsed = TlonConfigSchema.parse({
      lifecycle: {
        runTimeoutMs: 120_000,
        toolTimeoutMs: 45_000,
      },
      accounts: {
        hosted: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          lifecycle: {
            runTimeoutMs: 90_000,
          },
        },
      },
    });

    expect(parsed.lifecycle?.toolTimeoutMs).toBe(45_000);
    expect(parsed.accounts?.hosted?.lifecycle?.runTimeoutMs).toBe(90_000);
  });

  it('accepts context lens configuration', () => {
    const parsed = TlonConfigSchema.parse({
      contextLens: {
        enabled: true,
        ttlMs: 600_000,
        maxEntries: 500,
        visibilityDefault: 'owner',
        authToken: 'a-token-of-sufficient-length',
        allowedOrigins: ['https://app.tlon.network'],
      },
      accounts: {
        hosted: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          contextLens: {
            enabled: false,
          },
        },
      },
    });

    expect(parsed.contextLens?.enabled).toBe(true);
    expect(parsed.contextLens?.allowedOrigins).toEqual([
      'https://app.tlon.network',
    ]);
    expect(parsed.accounts?.hosted?.contextLens?.enabled).toBe(false);
  });

  it('accepts context lens store configuration', () => {
    const parsed = TlonConfigSchema.parse({
      contextLens: {
        enabled: true,
        authToken: 'a-token-of-sufficient-length',
        store: {
          enabled: true,
          path: '/var/lib/openclaw/context-lens-runs.jsonl',
          retainDays: 14,
          maxStored: 250,
        },
      },
    });

    expect(parsed.contextLens?.store?.retainDays).toBe(14);
    expect(parsed.contextLens?.store?.maxStored).toBe(250);
  });

  it('rejects invalid context lens store retention values', () => {
    expect(() =>
      TlonConfigSchema.parse({
        contextLens: { store: { retainDays: 0 } },
      })
    ).toThrow();
    expect(() =>
      TlonConfigSchema.parse({
        contextLens: { store: { maxStored: -5 } },
      })
    ).toThrow();
  });

  it('rejects context lens auth tokens that are too short', () => {
    expect(() =>
      TlonConfigSchema.parse({
        contextLens: { authToken: 'short' },
      })
    ).toThrow();
  });

  it('rejects unknown context lens visibility values', () => {
    expect(() =>
      TlonConfigSchema.parse({
        contextLens: { visibilityDefault: 'everyone' },
      })
    ).toThrow();
  });

  it('accepts an opt-in reengagement.enabled flag', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
      reengagement: { enabled: true },
    });
    expect(parsed.reengagement?.enabled).toBe(true);
  });

  it('accepts an absent reengagement block and leaves the flag undefined', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
    });
    expect(parsed.reengagement).toBeUndefined();
  });

  it('accepts reengagement.enabled = false explicitly', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
      reengagement: { enabled: false },
    });
    expect(parsed.reengagement?.enabled).toBe(false);
  });

  it('accepts a channels.tlon.nudgeActiveHours block with 24-hour bounds', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
      nudgeActiveHours: { start: '00:00', end: '24:00', timezone: 'UTC' },
    });
    expect(parsed.nudgeActiveHours).toEqual({
      start: '00:00',
      end: '24:00',
      timezone: 'UTC',
    });
  });

  it('accepts a partial nudgeActiveHours block with no timezone', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
      nudgeActiveHours: { start: '09:00', end: '17:00' },
    });
    expect(parsed.nudgeActiveHours).toEqual({ start: '09:00', end: '17:00' });
  });

  it('accepts ownerListenEnabled and ownerListenDisabledChannels', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
      ownerListenEnabled: false,
      ownerListenDisabledChannels: ['chat/~zod/foo', 'diary/~bus/bar'],
    });
    expect(parsed.ownerListenEnabled).toBe(false);
    expect(parsed.ownerListenDisabledChannels).toEqual([
      'chat/~zod/foo',
      'diary/~bus/bar',
    ]);
  });

  it('treats owner-listen fields as optional', () => {
    const parsed = TlonConfigSchema.parse({
      ship: '~zod',
      url: 'https://example.com',
      code: 'code-123',
    });
    expect(parsed.ownerListenEnabled).toBeUndefined();
    expect(parsed.ownerListenDisabledChannels).toBeUndefined();
  });
});
