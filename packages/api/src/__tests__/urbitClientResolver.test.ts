import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  BadResponseError,
  poke,
  requestJson,
  scry,
  setClientResolver,
  startSpinHintCheck,
} from '../client/urbit';
import { configureLoggerFactory } from '../lib/logger';
import { AuthError, type Urbit } from '../http-api';

function makeLoggerStub() {
  return {
    ...console,
    crumb: vi.fn(),
    sensitiveCrumb: vi.fn(),
    trackError: vi.fn(),
    trackEvent: vi.fn(),
  };
}

function stubLogger() {
  const stub = makeLoggerStub();
  configureLoggerFactory(() => stub as any);
  return stub;
}

afterEach(() => {
  setClientResolver(null);
  configureLoggerFactory(() => makeLoggerStub() as any);
});

describe('client resolver', () => {
  test('routes an operation through the resolved client', async () => {
    const scopedClient = {
      poke: vi.fn().mockResolvedValue(7),
      requestJson: vi.fn().mockResolvedValue({ ok: true }),
      scryWithInfo: vi.fn().mockResolvedValue({
        result: { ship: '~zod' },
        responseSizeInBytes: 0,
        responseStatus: 200,
      }),
    };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(poke({ app: 'chat', mark: 'test', json: {} })).resolves.toBe(
      7
    );
    await expect(scry({ app: 'contacts', path: '/v1/self' })).resolves.toEqual({
      ship: '~zod',
    });
    await expect(requestJson('/notes', 'GET')).resolves.toEqual({ ok: true });
  });

  test('routes spin hints through the resolved client', async () => {
    const scopedClient = {
      getSpinHints: vi.fn().mockResolvedValue('/root'),
    };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(startSpinHintCheck().settleWithin(500)).resolves.toMatchObject(
      {
        outcome: 'hint',
        nodeBusyStatus: 'available',
      }
    );
    expect(scopedClient.getSpinHints).toHaveBeenCalledOnce();
  });

  test('does not run singleton reauthentication for a scoped client', async () => {
    const rejection = Object.assign(new Error('forbidden'), { status: 403 });
    const scopedClient = {
      requestJson: vi.fn().mockRejectedValue(rejection),
    };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(requestJson('/notes', 'GET')).rejects.toEqual(
      expect.objectContaining<Partial<BadResponseError>>({ status: 403 })
    );
    expect(scopedClient.requestJson).toHaveBeenCalledTimes(1);
  });

  test('does not run singleton reauthentication for a scoped poke', async () => {
    const rejection = new AuthError('forbidden');
    const scopedClient = { poke: vi.fn().mockRejectedValue(rejection) };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(poke({ app: 'chat', mark: 'test', json: {} })).rejects.toBe(
      rejection
    );
    expect(scopedClient.poke).toHaveBeenCalledOnce();
  });

  test('a failed scoped poke reports no singleton session state', async () => {
    // config's epoch, pending login and connection status belong to the
    // singleton; a scoped client owns its own auth, so they would describe
    // the wrong connection entirely
    const { trackError } = stubLogger();
    const scopedClient = {
      channelId: '1700000000-abc123',
      channelOpened: true,
      poke: vi.fn().mockRejectedValue(new AuthError('invalid session')),
    };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(
      poke({ app: 'chat', mark: 'test', json: {} })
    ).rejects.toBeInstanceOf(AuthError);

    const props = trackError.mock.calls[0][1] as Record<string, unknown>;
    expect(props).toMatchObject({ app: 'chat', mark: 'test' });
    expect(props.channelOpened).toBe(true);
    expect(props.channelAgeSeconds).toEqual(expect.any(Number));
    for (const key of [
      'authEpoch',
      'reauthsDuringPoke',
      'reauthInFlight',
      'connectionStatus',
    ]) {
      expect(props).not.toHaveProperty(key);
    }
  });

  test('an empty scope does not fall through to the configured client', async () => {
    setClientResolver(() => null);

    await expect(poke({ app: 'chat', mark: 'test', json: {} })).rejects.toThrow(
      'Client not initialized'
    );
  });
});
