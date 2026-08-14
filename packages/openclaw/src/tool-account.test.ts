import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { resolveTlonToolAccountId } from './tool-account.js';

function config(): OpenClawConfig {
  return {
    channels: {
      tlon: {
        accounts: {
          alpha: { ship: '~alpha', url: 'http://alpha', code: 'alpha-code' },
          beta: { ship: '~beta', url: 'http://beta', code: 'beta-code' },
        },
      },
    },
    bindings: [
      {
        agentId: 'tenant-alpha',
        match: { channel: 'tlon', accountId: 'alpha' },
      },
      {
        agentId: 'tenant-beta',
        match: { channel: 'tlon', accountId: 'beta' },
      },
    ],
  } as OpenClawConfig;
}

describe('resolveTlonToolAccountId', () => {
  it('resolves an account from the active agent binding for internal runs', () => {
    expect(
      resolveTlonToolAccountId({ cfg: config(), agentId: 'tenant-alpha' })
    ).toBe('alpha');
  });

  it('accepts a matching trusted delivery route', () => {
    expect(
      resolveTlonToolAccountId({
        cfg: config(),
        agentId: 'tenant-beta',
        deliveryContext: { channel: 'tlon', accountId: 'beta' },
      })
    ).toBe('beta');
  });

  it('rejects a delivery route for another agent account', () => {
    expect(() =>
      resolveTlonToolAccountId({
        cfg: config(),
        agentId: 'tenant-alpha',
        deliveryContext: { channel: 'tlon', accountId: 'beta' },
      })
    ).toThrow('not bound');
  });

  it('rejects an unbound agent in a multitenant gateway', () => {
    expect(() =>
      resolveTlonToolAccountId({ cfg: config(), agentId: 'unbound-main' })
    ).toThrow('unique Tlon account');
  });

  it('rejects an agent bound to multiple exact accounts', () => {
    const cfg = config();
    cfg.bindings?.push({
      agentId: 'tenant-alpha',
      match: { channel: 'tlon', accountId: 'beta' },
    });
    expect(() =>
      resolveTlonToolAccountId({ cfg, agentId: 'tenant-alpha' })
    ).toThrow('multiple Tlon accounts');
  });

  it('preserves a legacy single-account install without bindings', () => {
    const cfg = {
      channels: {
        tlon: { ship: '~zod', url: 'http://zod', code: 'zod-code' },
      },
    } as OpenClawConfig;
    expect(resolveTlonToolAccountId({ cfg, agentId: 'main' })).toBe('default');
  });

  it('requires an exact binding for one account in monolithic mode', () => {
    const cfg = {
      channels: {
        tlon: {
          deploymentMode: 'monolithic',
          accounts: {
            alpha: {
              ship: '~alpha',
              url: 'http://alpha',
              code: 'alpha-code',
            },
          },
        },
      },
    } as OpenClawConfig;

    expect(() =>
      resolveTlonToolAccountId({ cfg, agentId: 'tenant-alpha' })
    ).toThrow(/unique Tlon account/i);
  });

  it('returns null only when no configured account exists', () => {
    expect(
      resolveTlonToolAccountId({ cfg: {} as OpenClawConfig, agentId: 'main' })
    ).toBeNull();
  });
});
