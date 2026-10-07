import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authorizeBrowserLoginHandoff,
  browserVaultOwnerRequest,
  deleteBrowserLogin,
  listBrowserLogins,
} from './browserVault';

const mocks = vi.hoisted(() => ({ scry: vi.fn(), fetch: vi.fn() }));
vi.mock('./requests', () => ({
  base: { genuineSecret: {} },
  scryRequest: () => mocks.scry,
}));
vi.mock('./urbit', () => ({ getCurrentUserId: () => '~sampel-palnet' }));
vi.mock('../types', () => ({
  getConstants: () => ({ API_URL: 'https://test.tlon.systems' }),
}));
const endpoint = `https://browser-session.tlon.network/credential-vault/${'a'.repeat(43)}`;
const account = {
  id: '8e40b5f5-fd41-4851-8922-b9545e470d6e',
  revision: 1,
  origin: 'https://login.example',
  updatedAt: 1,
  label: 'Personal',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.scry.mockResolvedValue('owner-proof-private');
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ grant: 'g'.repeat(43), accounts: [account] }),
      { status: 200 }
    )
  );
});

describe('browser vault owner requests', () => {
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
    expect(mocks.scry).toHaveBeenCalledOnce();
  });
  it.each([
    'http://browser-session.tlon.network/vault/list',
    'https://evil.example/vault/list',
    'https://browser-session.tlon.network/other',
    `${endpoint}?token=x`,
    'https://user:pass@browser-session.tlon.network/vault/list',
  ])('rejects %s before reading owner proof', async (url) => {
    await expect(browserVaultOwnerRequest(url, {})).rejects.toThrow('trusted');
    expect(mocks.scry).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('lists metadata and deletes only the explicit revision on the configured bot moon', async () => {
    expect(await listBrowserLogins('~pinser-botter-sampel-palnet')).toEqual([
      account,
    ]);
    mocks.fetch.mockResolvedValue(new Response('{"ok":true}'));
    await deleteBrowserLogin('~pinser-botter-sampel-palnet', {
      id: account.id,
      revision: 1,
    });
    expect(mocks.fetch.mock.calls[1][0]).toBe(
      'https://browser-session-ovh-test-1.test.tlon.systems/vault/delete'
    );
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({
      planet: 'sampel-palnet',
      moon: 'pinser-botter-sampel-palnet',
      ownerToken: 'owner-proof-private',
      record: { id: account.id, revision: 1 },
    });
    expect(mocks.scry).toHaveBeenCalledTimes(2);
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
