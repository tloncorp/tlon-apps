import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createUrbitChannel,
  pokeUrbitChannel,
  scryUrbitPath,
  wakeUrbitChannel,
} from './channel-ops.js';
import { urbitFetch } from './fetch.js';

vi.mock('./fetch.js', () => ({
  urbitFetch: vi.fn(),
}));

describe('scryUrbitPath', () => {
  beforeEach(() => {
    vi.mocked(urbitFetch).mockReset();
    vi.mocked(urbitFetch).mockResolvedValue({
      response: {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('forwards timeout and abort signal to urbitFetch', async () => {
    const controller = new AbortController();

    await scryUrbitPath(
      { baseUrl: 'https://example.com', cookie: 'urbauth-~zod=123' },
      {
        path: '/channels/v4/chat/~zod/general/posts/post/1.json',
        auditContext: 'test-scry',
        timeoutMs: 123,
        signal: controller.signal,
      }
    );

    expect(urbitFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 123,
        signal: controller.signal,
      })
    );
  });

  it('keeps the 30-second default timeout', async () => {
    await scryUrbitPath(
      { baseUrl: 'https://example.com', cookie: 'urbauth-~zod=123' },
      { path: '/foo.json', auditContext: 'test-scry' }
    );

    expect(urbitFetch).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 30_000, signal: undefined })
    );
  });
});

describe('pokeUrbitChannel', () => {
  beforeEach(() => {
    vi.mocked(urbitFetch).mockReset();
    vi.mocked(urbitFetch).mockResolvedValue({
      response: {
        ok: true,
        status: 204,
      } as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('forwards a provided signal to urbitFetch', async () => {
    const controller = new AbortController();

    await pokeUrbitChannel(
      {
        baseUrl: 'https://example.com',
        cookie: 'urbauth-~zod=123',
        ship: '~zod',
        channelId: 'test-channel',
      },
      {
        app: 'hood',
        mark: 'helm-hi',
        json: {},
        auditContext: 'test-poke',
        signal: controller.signal,
      }
    );

    expect(urbitFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      })
    );
  });
});

describe('createUrbitChannel', () => {
  beforeEach(() => {
    vi.mocked(urbitFetch).mockReset();
    vi.mocked(urbitFetch).mockResolvedValue({
      response: {
        ok: true,
        status: 204,
      } as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('forwards a provided signal to urbitFetch', async () => {
    const controller = new AbortController();

    await createUrbitChannel(
      {
        baseUrl: 'https://example.com',
        cookie: 'urbauth-~zod=123',
        ship: '~zod',
        channelId: 'test-channel',
      },
      {
        body: [],
        auditContext: 'test-create',
        signal: controller.signal,
      }
    );

    expect(urbitFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      })
    );
  });
});

describe('wakeUrbitChannel', () => {
  beforeEach(() => {
    vi.mocked(urbitFetch).mockReset();
    vi.mocked(urbitFetch).mockResolvedValue({
      response: {
        ok: true,
        status: 204,
      } as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('forwards a provided signal to urbitFetch', async () => {
    const controller = new AbortController();

    await wakeUrbitChannel(
      {
        baseUrl: 'https://example.com',
        cookie: 'urbauth-~zod=123',
        ship: '~zod',
        channelId: 'test-channel',
      },
      { signal: controller.signal }
    );

    expect(urbitFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      })
    );
  });
});
