import { describe, expect, test, vi } from 'vitest';

import {
  BadResponseError,
  internalConfigureClient,
  internalRemoveClient,
  requestJson,
} from '../client/urbit';
import { Urbit } from '../http-api/Urbit';
import { configureLoggerFactory } from '../lib/logger';
import { AnalyticsEvent } from '../types/analytics';

function configureTestLogger(trackEvent = vi.fn()) {
  configureLoggerFactory(() => ({
    ...console,
    crumb: vi.fn(),
    sensitiveCrumb: vi.fn(),
    trackError: vi.fn(),
    trackEvent,
  }));
  return trackEvent;
}

describe('Urbit.requestJson', () => {
  test('returns parsed JSON for a successful JSON response', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}'));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(urbit.requestJson('/notes/~/v1/notebooks')).resolves.toEqual({
      ok: true,
    });
  });

  test('returns undefined for successful empty responses', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(
      urbit.requestJson('/notes/~/v1/notebooks/~zod/blog/notes/12', 'DELETE')
    ).resolves.toBeUndefined();
  });

  test('rejects non-OK responses without parsing their body', async () => {
    const response = new Response('not found', { status: 404 });
    const fetch = vi.fn(async () => response);
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(urbit.requestJson('/missing', 'GET')).rejects.toBe(response);
  });
});

describe('client requestJson wrapper', () => {
  test('turns blank HTTP failures into a nonblank BadResponseError message', async () => {
    const client = {
      requestJson: vi.fn(async () => {
        throw new Response('', { status: 404 });
      }),
      delete: vi.fn(),
      on: vi.fn(),
    };

    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      client: client as any,
    });

    try {
      await expect(requestJson('/missing', 'GET')).rejects.toMatchObject({
        status: 404,
        body: '',
        message: 'HTTP 404',
      });
      await expect(requestJson('/missing', 'GET')).rejects.toBeInstanceOf(
        BadResponseError
      );
    } finally {
      internalRemoveClient();
    }
  });

  test('tracks notes v1 requests without sending request bodies', async () => {
    const trackEvent = configureTestLogger();
    const client = {
      requestJson: vi.fn(async () => ({
        requestId: '0v1mr.fs4g1',
        body: { type: 'pending' },
      })),
      delete: vi.fn(),
      on: vi.fn(),
    };

    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      client: client as any,
    });

    try {
      await expect(
        requestJson('/notes/~/v1/notebooks/~zod/blog/notes/12', 'PUT', {
          body: 'do not track me',
        })
      ).resolves.toEqual({
        requestId: '0v1mr.fs4g1',
        body: { type: 'pending' },
      });

      expect(trackEvent).toHaveBeenCalledWith(
        AnalyticsEvent.NotesRequest,
        expect.objectContaining({
          method: 'PUT',
          path: '/notes/~/v1/notebooks/[notebook]/notes/12',
          responseType: 'pending',
          status: 'success',
        })
      );
      expect(JSON.stringify(trackEvent.mock.calls)).not.toContain(
        'do not track me'
      );
    } finally {
      internalRemoveClient();
      configureTestLogger();
    }
  });

  test('tracks notes v1 failures with redacted error bodies', async () => {
    const trackEvent = configureTestLogger();
    const client = {
      requestJson: vi.fn(async () => {
        throw new Response(
          '%notes write request is still pending (request 0v1mr.fs4g1.h4vsm.ns5oo)',
          { status: 500 }
        );
      }),
      delete: vi.fn(),
      on: vi.fn(),
    };

    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      client: client as any,
    });

    try {
      await expect(
        requestJson('/notes/~/v1/request/0v1mr.fs4g1.h4vsm.ns5oo', 'GET')
      ).rejects.toBeInstanceOf(BadResponseError);

      expect(trackEvent).toHaveBeenCalledWith(
        AnalyticsEvent.NotesRequest,
        expect.objectContaining({
          errorMessage:
            '%notes write request is still pending (request [request-id])',
          path: '/notes/~/v1/request/[request-id]',
          responseStatus: 500,
          status: 'error',
        })
      );
    } finally {
      internalRemoveClient();
      configureTestLogger();
    }
  });
});
