import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Urbit } from '../http-api';
import {
  internalConfigureClient,
  internalRemoveClient,
  subscribe,
} from './urbit';

function configureMockClient() {
  const client = {
    delete: vi.fn(),
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(42),
  };
  internalConfigureClient({
    shipName: '~zod',
    shipUrl: 'http://example.test',
    client: client as unknown as Urbit,
  });
  return client;
}

afterEach(() => {
  internalRemoveClient();
});

describe('client subscribe wrapper', () => {
  test('preserves automatic resubscription when options are omitted', async () => {
    const client = configureMockClient();

    await subscribe({ app: 'groups', path: '/v1' }, vi.fn());

    expect(client.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ resubOnQuit: true })
    );
  });

  test('allows callers to disable automatic resubscription explicitly', async () => {
    const client = configureMockClient();

    await subscribe({ app: 'groups', path: '/v1' }, vi.fn(), {
      resubOnQuit: false,
    });

    expect(client.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ resubOnQuit: false })
    );
  });
});
