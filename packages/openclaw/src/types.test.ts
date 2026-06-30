import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { resolveTlonAccount } from './types.js';

describe('resolveTlonAccount moon (virtual identity)', () => {
  it('defaults moon to null (acts as the host ship)', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: { ship: '~zod', url: 'https://example.com', code: 'code-123' },
      },
    } as OpenClawConfig);
    expect(account.ship).toBe('~zod');
    expect(account.moon).toBeNull();
  });

  it('exposes a configured moon alongside the host credentials', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~sampel-palnet',
          url: 'https://example.com',
          code: 'code-123',
          moon: '~doznec-sampel-palnet',
        },
      },
    } as OpenClawConfig);
    // credentials are the host's; identity is the moon
    expect(account.ship).toBe('~sampel-palnet');
    expect(account.moon).toBe('~doznec-sampel-palnet');
    expect(account.configured).toBe(true);
  });

  it('reads moon from a named account override', () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            accounts: {
              hosted: {
                ship: '~sampel-palnet',
                url: 'https://example.com',
                code: 'code-123',
                moon: '~doznec-sampel-palnet',
              },
            },
          },
        },
      } as OpenClawConfig,
      'hosted'
    );
    expect(account.moon).toBe('~doznec-sampel-palnet');
  });
});

describe('resolveTlonAccount telemetry', () => {
  it('defaults telemetry to disabled', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
        },
      },
    } as OpenClawConfig);

    expect(account.telemetry).toEqual({
      enabled: false,
      apiKey: null,
      host: null,
    });
  });

  it('merges base and account telemetry settings', () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            telemetry: {
              enabled: true,
              apiKey: 'phc_base',
              host: 'https://eu.i.posthog.com',
            },
            accounts: {
              hosted: {
                ship: '~zod',
                url: 'https://example.com',
                code: 'code-123',
                telemetry: {
                  apiKey: 'phc_account',
                },
              },
            },
          },
        },
      } as OpenClawConfig,
      'hosted'
    );

    expect(account.telemetry).toEqual({
      enabled: true,
      apiKey: 'phc_account',
      host: 'https://eu.i.posthog.com',
    });
  });

  it('still requires an explicit enable flag', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          telemetry: {
            apiKey: 'phc_base',
          },
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
        },
      },
    } as OpenClawConfig);

    expect(account.telemetry.enabled).toBe(false);
    expect(account.telemetry.apiKey).toBe('phc_base');
  });
});

describe('resolveTlonAccount allowPrivateNetwork', () => {
  it('reads the canonical nested network.dangerouslyAllowPrivateNetwork', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          network: { dangerouslyAllowPrivateNetwork: true },
        },
      },
    } as OpenClawConfig);

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it('falls back to the legacy flat allowPrivateNetwork alias', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          allowPrivateNetwork: true,
        },
      },
    } as OpenClawConfig);

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it('prefers the canonical shape over the legacy alias when both are set', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          allowPrivateNetwork: false,
          network: { dangerouslyAllowPrivateNetwork: true },
        },
      },
    } as OpenClawConfig);

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it('reads per-account nested network override', () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            accounts: {
              hosted: {
                ship: '~zod',
                url: 'https://example.com',
                code: 'code-123',
                network: { dangerouslyAllowPrivateNetwork: true },
              },
            },
          },
        },
      } as OpenClawConfig,
      'hosted'
    );

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it('honors a per-account legacy alias even when base is canonical', () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            network: { dangerouslyAllowPrivateNetwork: true },
            accounts: {
              hosted: {
                ship: '~zod',
                url: 'https://example.com',
                code: 'code-123',
                allowPrivateNetwork: false,
              },
            },
          },
        },
      } as OpenClawConfig,
      'hosted'
    );

    expect(account.allowPrivateNetwork).toBe(false);
  });
});

describe('resolveTlonAccount lifecycle', () => {
  it('defaults lifecycle timeouts to null', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
        },
      },
    } as OpenClawConfig);

    expect(account.lifecycle).toEqual({
      runTimeoutMs: null,
      toolTimeoutMs: null,
    });
  });

  it('merges base and account lifecycle settings', () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
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
          },
        },
      } as OpenClawConfig,
      'hosted'
    );

    expect(account.lifecycle).toEqual({
      runTimeoutMs: 90_000,
      toolTimeoutMs: 45_000,
    });
  });
});

describe('resolveTlonAccount contextLens', () => {
  it('defaults to disabled with owner visibility', () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
        },
      },
    } as OpenClawConfig);

    expect(account.contextLens).toEqual({
      enabled: false,
      ttlMs: null,
      maxEntries: null,
      visibilityDefault: 'owner',
      authToken: null,
      allowedOrigins: [],
      owner: null,
      store: { enabled: true, path: null, retainDays: null, maxStored: null },
    });
  });

  it('merges base and account context lens settings', () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            contextLens: {
              enabled: true,
              ttlMs: 600_000,
              authToken: 'a-token-of-sufficient-length',
            },
            accounts: {
              hosted: {
                ship: '~zod',
                url: 'https://example.com',
                code: 'code-123',
                contextLens: {
                  maxEntries: 500,
                  visibilityDefault: 'internal',
                },
              },
            },
          },
        },
      } as OpenClawConfig,
      'hosted'
    );

    expect(account.contextLens).toEqual({
      enabled: true,
      ttlMs: 600_000,
      maxEntries: 500,
      visibilityDefault: 'internal',
      authToken: 'a-token-of-sufficient-length',
      allowedOrigins: [],
      owner: null,
      store: { enabled: true, path: null, retainDays: null, maxStored: null },
    });
  });
});
