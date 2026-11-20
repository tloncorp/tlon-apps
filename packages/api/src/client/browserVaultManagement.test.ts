import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getVaultLogin,
  listVaultLogins,
  removeVaultLogin,
} from './browserVaultManagement';

const request = vi.hoisted(() => vi.fn());
vi.mock('./browserOwnerSession', () => ({
  browserOwnerServiceOrigin: () => 'https://kernel.tlon.systems',
  browserOwnerRequest: request,
}));
beforeEach(() => request.mockReset());

describe('vault management requests', () => {
  it('uses owner authentication without a viewer URL or browser session', async () => {
    const signal = new AbortController().signal;
    request.mockResolvedValue({ credentials: [{ key: 'login' }] });
    expect(await listVaultLogins('bot-owner', signal)).toEqual([
      { key: 'login' },
    ]);
    expect(request).toHaveBeenCalledWith(
      'https://kernel.tlon.systems/owner/credentials',
      'bot-owner',
      'GET',
      undefined,
      signal
    );
  });
  it('addresses details and removal by the opaque login key', async () => {
    const signal = new AbortController().signal;
    request.mockResolvedValue({ key: 'a/b' });
    expect(await getVaultLogin('bot-owner', 'a/b', signal)).toEqual({
      key: 'a/b',
    });
    expect(request).toHaveBeenLastCalledWith(
      'https://kernel.tlon.systems/owner/credentials/a%2Fb',
      'bot-owner',
      'GET',
      undefined,
      signal
    );
    await removeVaultLogin('bot-owner', 'a/b');
    expect(request).toHaveBeenLastCalledWith(
      'https://kernel.tlon.systems/owner/credentials/a%2Fb',
      'bot-owner',
      'DELETE'
    );
  });
});
