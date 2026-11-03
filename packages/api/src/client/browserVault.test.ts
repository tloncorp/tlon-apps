import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ownerSessions from './browserOwnerSession';
import {
  authorizeBrowserLoginHandoff,
  browserVaultOwnerRequest,
  BrowserVaultRequestError,
} from './browserVault';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  fetch: vi.fn(),
  apiUrl: 'https://test.tlon.systems',
}));
vi.mock('./urbit', () => ({
  onClientSessionChange: vi.fn(),
  getClientGeneration: () => 0,
  getBrowserVaultOwnerAuthorization: () => mocks.authorize(),
}));
vi.mock('../types', () => ({
  getConstants: () => ({ API_URL: mocks.apiUrl }),
}));
const endpoint = `https://browser-session-ovh-test-1.test.tlon.systems/credential-vault/${'a'.repeat(43)}`;
const account = {
  id: '8e40b5f5-fd41-4851-8922-b9545e470d6e',
  revision: 1,
  origin: 'https://login.example',
  updatedAt: 1,
  label: 'Personal',
  username: 'me@example.com',
  permission: 'ask',
};
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.apiUrl = 'https://test.tlon.systems';
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.authorize.mockResolvedValue({
    planet: 'sampel-palnet',
    ownerToken: 'owner-proof-private',
  });
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ grant: 'g'.repeat(43), accounts: [account] }),
      { status: 200 }
    )
  );
});

describe('browser vault owner requests', () => {
  it.each([401, 404, 410])(
    'preserves viewer HTTP %s errors when reusing an owner session',
    async (status) => {
      vi.spyOn(ownerSessions, 'browserOwnerSessionMoon').mockReturnValue(
        'moon'
      );
      vi.spyOn(ownerSessions, 'browserOwnerRequest').mockRejectedValue(
        new ownerSessions.BrowserOwnerRequestError(status, 'private error')
      );
      const result = browserVaultOwnerRequest(
        'https://browser-session.test.tlon.systems/viewer-authorize',
        { capability: 'viewer-capability' }
      );
      await expect(result).rejects.toBeInstanceOf(BrowserVaultRequestError);
      await expect(result).rejects.toMatchObject({
        status,
        message: 'Saved logins are unavailable. Reconnect and try again.',
      });
    }
  );
  it('reads a fresh planet proof and sends it only in the trusted HTTPS body', async () => {
    expect(await authorizeBrowserLoginHandoff(endpoint)).toEqual({
      grant: 'g'.repeat(43),
      accounts: [account],
    });
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe(endpoint);
    expect(JSON.parse(options.body)).toEqual({
      planet: 'sampel-palnet',
      ownerToken: 'owner-proof-private',
    });
    expect(options).toMatchObject({
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(mocks.authorize).toHaveBeenCalledOnce();
  });
  it.each([
    'http://browser-session-ovh-test-1.test.tlon.systems/viewer-authorize',
    'https://evil.example/viewer-authorize',
    'https://browser-session.tlon.network/other',
    'https://browser-session.tlon.network/viewer-authorize',
    `${endpoint}?token=x`,
    'https://user:pass@browser-session-ovh-test-1.test.tlon.systems/viewer-authorize',
    'https://browser-session-ovh-test-1.test.tlon.systems/vault/list',
    'https://browser-session-ovh-test-1.test.tlon.systems:8443/viewer-authorize',
  ])('rejects %s before reading owner proof', async (url) => {
    await expect(browserVaultOwnerRequest(url, {})).rejects.toThrow('trusted');
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    [
      'https://test.tlon.systems',
      'browser-session-another-cluster.test.tlon.systems',
    ],
    [
      'https://api.tlon.network',
      'browser-session-another-cluster.tlon.network',
    ],
  ])('uses the supplied viewer endpoint for %s', async (apiUrl, viewerHost) => {
    mocks.apiUrl = apiUrl;
    const viewerEndpoint = `https://${viewerHost}/viewer-authorize`;
    await browserVaultOwnerRequest(viewerEndpoint, {
      capability: 'session-capability',
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      viewerEndpoint,
      expect.any(Object)
    );
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
      capability: 'session-capability',
      ownerToken: 'owner-proof-private',
    });
  });
  it('rejects a test viewer from the production app before reading owner authority', async () => {
    mocks.apiUrl = 'https://api.tlon.network';
    await expect(authorizeBrowserLoginHandoff(endpoint)).rejects.toThrow(
      'environment'
    );
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not expose remote errors or unknown secret fields to callers', async () => {
    mocks.fetch.mockResolvedValue(
      new Response('{"error":"private-password"}', { status: 403 })
    );
    await expect(authorizeBrowserLoginHandoff(endpoint)).rejects.toThrow(
      'Saved logins are unavailable.'
    );
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          grant: 'g'.repeat(43),
          accounts: [{ ...account, password: 'private-password' }],
        })
      )
    );
    expect(
      JSON.stringify(await authorizeBrowserLoginHandoff(endpoint))
    ).not.toContain('private-password');
  });
});

it.each([401, 403, 404, 503])(
  'preserves HTTP %s without exposing the response body',
  async (status) => {
    mocks.fetch.mockResolvedValue(
      new Response('private error details', { status })
    );
    const result = browserVaultOwnerRequest(endpoint, {});
    await expect(result).rejects.toBeInstanceOf(BrowserVaultRequestError);
    await expect(result).rejects.toMatchObject({
      status,
      message: 'Saved logins are unavailable. Reconnect and try again.',
    });
  }
);
