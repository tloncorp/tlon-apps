import { afterEach, expect, it, vi } from 'vitest';
import {
  browserPreviewEndpoint,
  fetchBrowserPreview,
  BrowserPreviewAuthorizationError,
} from './browserPreview';

vi.mock('@tloncorp/api/client/urbit', () => ({
  getBrowserVaultOwnerAuthorization: async () => ({
    planet: 'sampel-palnet',
    ownerToken: 'test-proof',
  }),
}));
vi.mock('../../../api/src/types', () => ({
  getConstants: () => ({ API_URL: 'https://api.tlon.network' }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
});
const viewer = 'https://browser-session.tlon.network/s/payload.signature';
it.each([
  [401, 'expired'],
  [404, 'ended'],
  [410, 'ended'],
])(
  'recognizes authorization HTTP %s before fetching a preview',
  async (status, expected) => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: status as number }));
    vi.stubGlobal('fetch', request);
    expect(await browserPreviewEndpoint(viewer)).toEqual({ status: expected });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toBe(
      'https://browser-session.tlon.network/viewer-authorize'
    );
  }
);
it.each([403, 503])(
  'does not permanently expire cards on authorization HTTP %s',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status }))
    );
    await expect(browserPreviewEndpoint(viewer)).rejects.toMatchObject({
      status,
    });
  }
);

it.each([401, 403])(
  'requires reauthorization on preview HTTP %s',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status }))
    );
    await expect(
      fetchBrowserPreview(`${viewer}/preview`, new AbortController().signal)
    ).rejects.toBeInstanceOf(BrowserPreviewAuthorizationError);
  }
);
