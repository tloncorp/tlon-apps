import type { OpenClawConfig } from 'openclaw/plugin-sdk/setup';
import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';
import { tlonSetupAdapter } from './setup-core.js';
import { tlonSetupWizard } from './setup-surface.js';

describe('tlon setup wizard', () => {
  it('marks the login code prompt sensitive with a value-free keep prompt', () => {
    const code = tlonSetupWizard.textInputs?.find(
      (input) => input.inputKey === 'code'
    );
    expect(code?.sensitive).toBe(true);
    expect(typeof code?.keepPrompt).toBe('string');
  });
});

describe('tlon setup adapter validateInput', () => {
  const validInput = {
    ship: '~sampel-palnet',
    url: 'https://urbit.example.com',
    code: 'test-code',
  };
  const configured = {
    channels: { tlon: { ...validInput } },
  } as OpenClawConfig;

  function validate(input: Record<string, unknown>, cfg: OpenClawConfig = {}) {
    return tlonSetupAdapter.validateInput?.({
      cfg,
      accountId: 'default',
      input,
    });
  }

  it.each([
    ['file:///etc/passwd', 'Invalid URL: URL must use http:// or https://'],
    [
      'ftp://urbit.example.com',
      'Invalid URL: URL must use http:// or https://',
    ],
    [
      'https://user:pass@urbit.example.com',
      'Invalid URL: URL must not include credentials',
    ],
    ['https://', 'Invalid URL: Invalid URL'],
  ])('rejects an unusable --url: %s', (url, expected) => {
    expect(validate({ ...validInput, url })).toBe(expected);
  });

  it('accepts the bare-host and path URL forms the runtime accepts', () => {
    expect(
      validate({ ...validInput, url: 'urbit.example.com/~/login?redirect=1' })
    ).toBeNull();
  });

  it('treats an explicitly empty --url as missing instead of falling back to config', () => {
    expect(validate({ ...validInput, url: '' }, configured)).toBe(
      'Tlon requires --url.'
    );
    expect(validate({ ...validInput, url: '   ' }, configured)).toBe(
      'Tlon requires --url.'
    );
  });

  it('falls back to the configured values when flags are omitted', () => {
    expect(validate({ code: 'replacement-code' }, configured)).toBeNull();
  });

  it('validates a config-resolved URL when --url is omitted', () => {
    expect(
      validate({ code: 'replacement-code' }, {
        channels: {
          tlon: { ...validInput, url: 'ftp://urbit.example.com' },
        },
      } as OpenClawConfig)
    ).toBe('Invalid URL: URL must use http:// or https://');
  });
});

describe('tlon setup status account scoping', () => {
  // Only the named `work` account carries credentials; root has none, so
  // other accounts do not inherit a configured ship.
  const onlyWorkConfigured = {
    channels: {
      tlon: {
        accounts: {
          work: {
            ship: '~nec',
            url: 'https://urbit.example.com',
            code: 'work-code',
          },
        },
      },
    },
  } as unknown as OpenClawConfig;
  const rootConfigured = {
    channels: {
      tlon: {
        ship: '~zod',
        url: 'https://urbit.example.com',
        code: 'base-code',
      },
    },
  } as unknown as OpenClawConfig;

  const statusSurfaces = [
    ['runtime wizard', tlonSetupWizard.status],
    ['plugin proxy', tlonPlugin.setupWizard!.status],
  ] as const;

  it.each(statusSurfaces)(
    '%s: answers for the selected account, not any account',
    async (_name, status) => {
      for (const accountId of ['second', 'default']) {
        expect(
          await status.resolveConfigured({ cfg: onlyWorkConfigured, accountId })
        ).toBe(false);
      }
      expect(
        await status.resolveStatusLines?.({
          cfg: onlyWorkConfigured,
          accountId: 'second',
          configured: false,
        })
      ).toEqual(['Tlon (second): needs setup']);
      expect(
        await status.resolveConfigured({
          cfg: onlyWorkConfigured,
          accountId: 'work',
        })
      ).toBe(true);
      expect(
        await status.resolveStatusLines?.({
          cfg: onlyWorkConfigured,
          accountId: 'work',
          configured: true,
        })
      ).toEqual(['Tlon (work): configured']);
    }
  );

  it.each(statusSurfaces)(
    '%s: without an account, still answers for any account',
    async (_name, status) => {
      expect(await status.resolveConfigured({ cfg: onlyWorkConfigured })).toBe(
        true
      );
      expect(
        await status.resolveStatusLines?.({
          cfg: onlyWorkConfigured,
          configured: true,
        })
      ).toEqual(['Tlon: configured']);
    }
  );

  it.each(statusSurfaces)(
    '%s: keeps the unlabeled single-account answer',
    async (_name, status) => {
      for (const accountId of [undefined, 'default']) {
        expect(
          await status.resolveConfigured({ cfg: rootConfigured, accountId })
        ).toBe(true);
        expect(
          await status.resolveStatusLines?.({
            cfg: rootConfigured,
            accountId,
            configured: true,
          })
        ).toEqual(['Tlon: configured']);
      }
      expect(await status.resolveConfigured({ cfg: {} })).toBe(false);
      expect(
        await status.resolveStatusLines?.({ cfg: {}, configured: false })
      ).toEqual(['Tlon: needs setup']);
    }
  );
});
