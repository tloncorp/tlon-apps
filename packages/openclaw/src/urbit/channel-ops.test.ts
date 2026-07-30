import { beforeEach, describe, expect, it, vi } from 'vitest';

import { scryUrbitPath, wakeUrbitChannel } from './channel-ops.js';
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

describe('wakeUrbitChannel', () => {
  beforeEach(() => {
    vi.mocked(urbitFetch).mockReset();
    vi.mocked(urbitFetch).mockResolvedValue({
      response: { ok: true, status: 200 } as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('serializes a caller-supplied poke ID', async () => {
    await wakeUrbitChannel(
      {
        baseUrl: 'https://example.com',
        cookie: 'urbauth-~zod=123',
        ship: '~zod',
        channelId: 'test-channel',
      },
      { pokeId: 424242 }
    );

    const callArgs = vi.mocked(urbitFetch).mock.calls[0][0];
    const body = JSON.parse(callArgs.init?.body as string);
    expect(body[0].id).toBe(424242);
  });
});
