import {
  type LookupFn,
  SsrFBlockedError,
} from 'openclaw/plugin-sdk/ssrf-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserToolSessionId,
  createBrowserHandoffResults,
  readBrowserHandoffResult,
} from './browser-handoff-results.js';

import { urbitFetch } from './urbit/fetch.js';

vi.mock('./urbit/fetch.js', () => ({ urbitFetch: vi.fn() }));

type Dependencies = Parameters<typeof createBrowserHandoffResults>[0];
type Handoff = NonNullable<
  Awaited<ReturnType<Dependencies['store']['lookup']>>
>;
const services: ReturnType<typeof createBrowserHandoffResults>[] = [];

function fixture() {
  const records = new Map<string, Handoff>();
  const store: Dependencies['store'] = {
    async register(key, value) {
      records.set(key, structuredClone(value));
    },
    async registerIfAbsent(key, value) {
      if (records.has(key)) return false;
      records.set(key, structuredClone(value));
      return true;
    },
    async lookup(key) {
      return structuredClone(records.get(key));
    },
    async consume(key) {
      const value = records.get(key);
      records.delete(key);
      return value;
    },
    async delete(key) {
      return records.delete(key);
    },
    async entries() {
      return [...records].map(([key, value]) => ({
        key,
        value: structuredClone(value),
        createdAt: 0,
      }));
    },
    async clear() {
      records.clear();
    },
  };
  const readResult = vi
    .fn<Dependencies['readResult']>()
    .mockResolvedValue({ status: 'pending' });
  const resume = vi.fn().mockResolvedValue({ runId: 'continuation' });
  const sessionIdFor = vi.fn().mockReturnValue('conversation-1');
  const warn = vi.fn();
  const deps = { store, readResult, resume, sessionIdFor, warn };
  const service = createBrowserHandoffResults(deps);
  services.push(service);
  const token = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 300,
      form: 'bound-form',
    })
  ).toString('base64url');
  const request = {
    browserSessionId: 'browser-1',
    viewerUrl: `https://browser-session-ovh2.tlon.network/s/${token}.${'a'.repeat(43)}`,
  };
  const ctx = {
    sessionKey: 'agent:main:tlon:dm:owner',
    sessionId: 'conversation-1',
  };
  return {
    service,
    deps,
    records,
    request,
    ctx,
    readResult,
    resume,
    sessionIdFor,
    warn,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(urbitFetch).mockReset();
});
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.stop()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('secure-entry result delivery', () => {
  it('resumes the originating conversation once after a fill without an app continuation', async () => {
    const f = fixture();
    await f.service.watch(f.request, f.ctx);
    expect(await f.service.isPending('browser-1')).toBe(true);
    f.service.start();
    await f.service.poll();
    expect(f.resume).not.toHaveBeenCalled();
    f.readResult.mockResolvedValue({ status: 'filled', submitted: true });
    await Promise.all([f.service.poll(), f.service.poll()]);
    await f.service.poll();
    expect(f.resume).toHaveBeenCalledExactlyOnceWith({
      sessionKey: f.ctx.sessionKey,
      message: expect.stringContaining('filled; submission attempted'),
      idempotencyKey: expect.stringMatching(
        /^tlon-browser-handoff:[a-f0-9]{64}$/
      ),
      deliver: true,
    });
    expect(f.resume.mock.calls[0][0].message).toContain(
      'does not confirm sign-in'
    );
    expect(f.resume.mock.calls[0][0].message).toContain('passkey');
    expect(f.resume.mock.calls[0][0].message).not.toContain(
      f.request.viewerUrl
    );
    expect(await f.service.isPending('browser-1')).toBe(false);
    expect(f.records.size).toBe(0);
  });

  it.each(['failed', 'cancelled'] as const)(
    'delivers %s without claiming success',
    async (status) => {
      const f = fixture();
      await f.service.watch(f.request, f.ctx);
      f.readResult.mockResolvedValue({ status });
      f.service.start();
      await f.service.poll();
      expect(f.resume).toHaveBeenCalledOnce();
      expect(f.resume.mock.calls[0][0].message).toContain(status);
      expect(f.records.size).toBe(0);
    }
  );

  it('recovers a pending handoff after a plugin restart', async () => {
    const f = fixture();
    await f.service.watch(f.request, f.ctx);
    await f.service.stop();
    const restarted = createBrowserHandoffResults(f.deps);
    services.push(restarted);
    f.readResult.mockResolvedValue({ status: 'filled', submitted: false });
    restarted.start();
    await restarted.poll();
    expect(f.resume).toHaveBeenCalledOnce();
    expect(f.resume.mock.calls[0][0].message).toContain(
      'submission not attempted'
    );
  });

  it('persists a completed result until the agent accepts it, reusing the delivery id', async () => {
    const f = fixture();
    await f.service.watch(f.request, f.ctx);
    f.readResult.mockResolvedValue({
      status: 'filled',
      submitted: true,
      saveStatus: 'failed',
    });
    f.resume.mockRejectedValueOnce(
      new Error('Gateway disconnected after acceptance')
    );
    f.service.start();
    await f.service.poll();
    expect(f.records.get('browser-1')?.result?.status).toBe('filled');
    expect(await f.service.isPending('browser-1')).toBe(true);
    await f.service.stop();
    const restarted = createBrowserHandoffResults(f.deps);
    services.push(restarted);
    f.readResult.mockRejectedValue(new Error('Browser is gone'));
    restarted.start();
    await restarted.poll();
    expect(f.resume).toHaveBeenCalledTimes(1);
    expect(await restarted.isPending('browser-1')).toBe(true);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await restarted.isPending('browser-1')).toBe(false);
    expect(f.resume).toHaveBeenCalledTimes(2);
    expect(f.resume.mock.calls[0][0]).toEqual(f.resume.mock.calls[1][0]);
    expect(f.records.size).toBe(0);
  });

  it('backs off result delivery across expiry and caps the delay at five minutes', async () => {
    const f = fixture();
    await f.service.watch(f.request, f.ctx);
    f.readResult.mockResolvedValue({ status: 'filled', submitted: false });
    f.resume.mockRejectedValue(new Error('Gateway unavailable'));
    f.service.start();
    await f.service.poll();
    for (const delay of [
      5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
    ]) {
      const attempts = f.resume.mock.calls.length;
      const retryAt = f.records.get('browser-1')!.deliveryRetry!.nextAttemptAt;
      expect(retryAt - Date.now()).toBe(delay);
      vi.setSystemTime(retryAt - 1);
      await f.service.poll();
      expect(f.resume).toHaveBeenCalledTimes(attempts);
      vi.setSystemTime(retryAt);
      await f.service.poll();
      expect(f.resume).toHaveBeenCalledTimes(attempts + 1);
    }
    f.resume.mockResolvedValue({ runId: 'accepted' });
    vi.setSystemTime(f.records.get('browser-1')!.deliveryRetry!.nextAttemptAt);
    await f.service.poll();
    expect(f.records.size).toBe(0);
    expect(
      new Set(f.resume.mock.calls.map(([request]) => request.idempotencyKey))
        .size
    ).toBe(1);
  });

  it('releases a failed delivery watch so the same browser can receive another card', async () => {
    const f = fixture();
    const cancel = await f.service.watch(f.request, f.ctx);
    await cancel();
    expect(await f.service.isPending('browser-1')).toBe(false);
    const nextToken = Buffer.from(
      JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 300,
        form: 'next-form',
      })
    ).toString('base64url');
    await f.service.watch(
      {
        ...f.request,
        viewerUrl: `https://browser-session.tlon.network/s/${nextToken}.signature`,
      },
      f.ctx
    );
    await cancel();
    expect(await f.service.isPending('browser-1')).toBe(true);
  });

  it.each([false, true])(
    'does not resume a reset conversation (reset during read=%s)',
    async (duringRead) => {
      const f = fixture();
      await f.service.watch(f.request, f.ctx);
      if (duringRead)
        f.readResult.mockImplementation(async () => {
          f.sessionIdFor.mockReturnValue('conversation-2');
          return { status: 'filled', submitted: true };
        });
      else f.sessionIdFor.mockReturnValue('conversation-2');
      f.service.start();
      await f.service.poll();
      expect(f.resume).not.toHaveBeenCalled();
      expect(f.records.size).toBe(0);
    }
  );

  it('retries transport errors, then reports expiry as unconfirmed instead of success', async () => {
    const f = fixture();
    await f.service.watch(f.request, f.ctx);
    f.readResult.mockRejectedValue(new Error('Network unavailable'));
    f.service.start();
    await f.service.poll();
    expect(f.resume).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 300_001);
    await f.service.poll();
    expect(f.resume.mock.calls[0][0].message).toContain(
      'Filling is not confirmed'
    );
  });

  it('requires a pending service result and an exact active conversation before accepting a handoff', async () => {
    const f = fixture();
    await expect(f.service.watch(f.request, {})).rejects.toThrow(
      'active agent conversation'
    );
    await expect(
      f.service.watch(f.request, { ...f.ctx, sessionId: 'old' })
    ).rejects.toThrow('active agent conversation');
    f.readResult.mockResolvedValueOnce({ status: 'failed' });
    await expect(f.service.watch(f.request, f.ctx)).rejects.toThrow(
      'result delivery is unavailable'
    );
    expect(f.records.size).toBe(0);
    await f.service.watch(f.request, f.ctx);
    await expect(f.service.watch(f.request, f.ctx)).rejects.toThrow(
      'waiting for secure entry'
    );
    expect(f.records.size).toBe(1);
  });
});

describe('service result transport', () => {
  function respond(response: Response) {
    const release = vi.fn().mockResolvedValue(undefined);
    vi.mocked(urbitFetch).mockResolvedValue({
      response,
      release,
      finalUrl:
        'https://browser-session.tlon.network/credential-result/payload.signature',
    });
    return release;
  }

  it('accepts only fixed status metadata through a pinned, deny-private-network request', async () => {
    const f = fixture();
    const release = respond(
      Response.json({
        status: 'filled',
        submitted: true,
        values: { password: 'private' },
        error: 'private',
      })
    );
    const signal = new AbortController().signal;
    await expect(
      readBrowserHandoffResult(f.request.viewerUrl, signal)
    ).resolves.toEqual({ status: 'filled', submitted: true });
    expect(urbitFetch).toHaveBeenCalledExactlyOnceWith({
      baseUrl: new URL(f.request.viewerUrl).origin,
      path: expect.stringMatching(/^\/credential-result\//),
      init: {
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      },
      ssrfPolicy: { allowPrivateNetwork: false },
      pinDns: true,
      maxRedirects: 0,
      timeoutMs: 5_000,
      signal,
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it.each([
    'http://browser-session.tlon.network',
    'https://evil.test',
    'https://browser-session.tlon.network:444',
    'https://user@browser-session.tlon.network',
  ])('rejects an untrusted result origin: %s', async (origin) => {
    await expect(
      readBrowserHandoffResult(
        `${origin}/s/payload.signature`,
        new AbortController().signal
      )
    ).rejects.toThrow();
    expect(urbitFetch).not.toHaveBeenCalled();
  });

  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1'])(
    'blocks a trusted hostname resolving to %s before making an HTTP request',
    async (address) => {
      const actual =
        await vi.importActual<typeof import('./urbit/fetch.js')>(
          './urbit/fetch.js'
        );
      const fetchImpl = vi.fn();
      const lookupFn = (async () => [
        { address, family: address.includes(':') ? 6 : 4 },
      ]) as unknown as LookupFn;
      vi.mocked(urbitFetch).mockImplementation((options) =>
        actual.urbitFetch({ ...options, lookupFn, fetchImpl })
      );
      await expect(
        readBrowserHandoffResult(
          fixture().request.viewerUrl,
          new AbortController().signal
        )
      ).rejects.toBeInstanceOf(SsrFBlockedError);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it.each([401, 404])(
    'releases an unavailable handoff response for HTTP %s',
    async (status) => {
      const release = respond(Response.json({}, { status }));
      await expect(
        readBrowserHandoffResult(
          fixture().request.viewerUrl,
          new AbortController().signal
        )
      ).resolves.toEqual({ status: 'failed' });
      expect(release).toHaveBeenCalledOnce();
    }
  );

  it.each([
    { name: 'HTTP error', response: () => new Response('', { status: 500 }) },
    { name: 'invalid JSON', response: () => new Response('{') },
    {
      name: 'invalid result',
      response: () => Response.json({ status: 'unknown' }),
    },
  ])('releases the response after $name', async ({ response }) => {
    const release = respond(response());
    await expect(
      readBrowserHandoffResult(
        fixture().request.viewerUrl,
        new AbortController().signal
      )
    ).rejects.toThrow();
    expect(release).toHaveBeenCalledOnce();
  });
});

it.each(['browser_act', 'browser_browser_act'])(
  'identifies pending browser operations for %s with both argument encodings',
  (name) => {
    const args = { session_id: 'browser-1' };
    for (const argumentsValue of [args, JSON.stringify(args)])
      expect(
        browserToolSessionId('mcp__call', { name, arguments: argumentsValue })
      ).toBe('browser-1');
    expect(
      browserToolSessionId('mcp__call', { name, arguments: '{' })
    ).toBeUndefined();
    expect(
      browserToolSessionId('mcp__call', {
        name: 'other_action',
        arguments: args,
      })
    ).toBeUndefined();
  }
);
