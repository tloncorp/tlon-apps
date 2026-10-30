import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  generation: 0,
  authorize: vi.fn(),
  fetch: vi.fn(),
  change: undefined as undefined | (() => void),
}));
vi.mock('./urbit', () => ({
  getClientGeneration: () => state.generation,
  onClientSessionChange: (fn: () => void) => {
    state.change = fn;
  },
  getBrowserVaultOwnerAuthorization: (time: number) => state.authorize(time),
}));
vi.mock('../types', () => ({
  getConstants: () => ({ API_URL: 'https://test.tlon.systems' }),
}));
import {
  browserOwnerRequest,
  clearBrowserOwnerSessions,
} from './browserOwnerSession';
const origin = 'https://browser-session.test.tlon.systems';
const endpoint = `${origin}/owner/credentials`;
const session = () => ({
  token: 'owner_v1_test',
  expiresAt: Date.now() + 3_600_000,
  idleTimeoutMs: 900_000,
});
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  clearBrowserOwnerSessions();
  vi.clearAllMocks();
  state.generation = 0;
  state.authorize.mockResolvedValue({
    planet: 'sampel-palnet',
    ownerToken: 'private-proof',
  });
  state.fetch.mockImplementation(async (url: string) =>
    response(url.endsWith('/owner/sessions') ? session() : { credentials: [] })
  );
  vi.stubGlobal('fetch', state.fetch);
});
describe('browser owner sessions', () => {
  it('coalesces exchange and sends only bearer headers on later operations', async () => {
    await Promise.all([
      browserOwnerRequest(endpoint, 'moon', 'GET'),
      browserOwnerRequest(endpoint, 'moon', 'GET'),
    ]);
    await browserOwnerRequest(`${endpoint}/login-a`, 'moon', 'DELETE');
    expect(state.authorize).toHaveBeenCalledOnce();
    expect(
      state.fetch.mock.calls.filter(([url]) => url.endsWith('/owner/sessions'))
    ).toHaveLength(1);
    for (const [url, options] of state.fetch.mock.calls.slice(1)) {
      expect(url).not.toContain('owner_v1');
      expect(options).toMatchObject({
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        headers: { Authorization: 'Bearer owner_v1_test' },
      });
      expect(options.body).toBeUndefined();
    }
  });
  it('rejects foreign and cross-environment origins before reading proof', async () => {
    for (const url of [
      'https://evil.example/owner/credentials',
      'http://browser-session.test.tlon.systems/owner/credentials',
      'https://browser-session.tlon.network/owner/credentials',
      `${endpoint}?token=x`,
    ]) {
      await expect(browserOwnerRequest(url, 'moon', 'GET')).rejects.toThrow();
    }
    expect(state.authorize).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('renews once after auth rejection but never replays an uncertain deletion', async () => {
    let rejected = false;
    state.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/owner/sessions')) return response(session());
      if (!rejected) {
        rejected = true;
        return response({ error: 'unauthorized' }, 401);
      }
      return response({ credentials: [] });
    });
    await browserOwnerRequest(endpoint, 'moon', 'GET');
    expect(state.authorize).toHaveBeenCalledTimes(2);
    expect(state.authorize.mock.calls[1][0]).toBeGreaterThan(
      state.authorize.mock.calls[0][0]
    );
    state.fetch.mockRejectedValue(new Error('connection lost'));
    await expect(
      browserOwnerRequest(`${endpoint}/login-a`, 'moon', 'DELETE')
    ).rejects.toThrow('connection lost');
    expect(
      state.fetch.mock.calls.filter(([url]) => url === `${endpoint}/login-a`)
    ).toHaveLength(1);
  });
  it('uses a later proof if another tab already exchanged the current one', async () => {
    state.fetch.mockResolvedValueOnce(
      response({ error: 'proof_already_exchanged' }, 409)
    );
    await browserOwnerRequest(endpoint, 'moon', 'GET');
    expect(state.authorize).toHaveBeenCalledTimes(2);
    expect(state.authorize.mock.calls[1][0]).toBeGreaterThan(
      state.authorize.mock.calls[0][0]
    );
  });

  it('revokes an exchange that completes after switching accounts without using it', async () => {
    let resolve!: (value: Response) => void;
    state.fetch.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      })
    );
    const operation = browserOwnerRequest(endpoint, 'moon', 'GET');
    await vi.waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
    state.generation++;
    state.change?.();
    resolve(response(session()));
    await expect(operation).rejects.toThrow('Account changed');
    await vi.waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(2));
    expect(state.fetch.mock.calls[1][0]).toBe(
      `${origin}/owner/sessions/current`
    );
    expect(state.fetch.mock.calls.some(([url]) => url === endpoint)).toBe(
      false
    );
  });
  it('clears and revokes cached sessions on logout', async () => {
    await browserOwnerRequest(endpoint, 'moon', 'GET');
    state.generation++;
    state.change?.();
    await browserOwnerRequest(endpoint, 'moon', 'GET');
    expect(state.authorize).toHaveBeenCalledTimes(2);
    expect(
      state.fetch.mock.calls.filter(([url]) => url.endsWith('/current'))
    ).toHaveLength(1);
  });
});
