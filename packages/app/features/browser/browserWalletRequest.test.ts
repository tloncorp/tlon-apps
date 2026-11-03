import { afterEach, describe, expect, it, vi } from 'vitest';
import { walletActionRequest, walletActionUrl } from './browserWalletRequest';
const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('wallet owner bridge', () => {
  it('binds the request to the configured ship origin and a fixed path', () => {
    expect(
      walletActionUrl('https://ten.example/apps/groups/', id, 'view')
    ).toBe(`https://ten.example/apps/browser-wallet/actions/${id}/view`);
    expect(() =>
      walletActionUrl('https://ten.example', '../attacker', 'view')
    ).toThrow();
    expect(() =>
      walletActionUrl('https://ten.example', id, '../attacker')
    ).toThrow();
    expect(() =>
      walletActionUrl('https://user:secret@ten.example', id, 'view')
    ).toThrow();
    expect(() => walletActionUrl(null, id, 'view')).toThrow();
  });
  it('uses native ship cookies without passing an API key or stale cookie copy', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await walletActionRequest({
      shipUrl: 'http://127.0.0.1:43850',
      requestId: id,
      operation: 'view',
      body: {},
      native: true,
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      `http://127.0.0.1:43850/apps/browser-wallet/actions/${id}/view`
    );
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      Origin: 'http://127.0.0.1:43850',
    });
    expect(init.credentials).toBeUndefined();
    expect(init.redirect).toBe('error');
  });
  it('keeps web requests same-origin', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await walletActionRequest({
      shipUrl: 'https://ten.example',
      requestId: id,
      operation: 'cancel',
      body: {},
      native: false,
    });
    expect(fetcher.mock.calls[0][1].credentials).toBe('same-origin');
    expect(fetcher.mock.calls[0][1].headers).toEqual({
      'content-type': 'application/json',
    });
  });
});
