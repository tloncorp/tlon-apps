import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openAuthSessionAsync: vi.fn(),
  openURL: vi.fn(),
  platform: { OS: 'ios' },
}));

vi.mock('expo-web-browser', () => ({
  openAuthSessionAsync: mocks.openAuthSessionAsync,
}));

vi.mock('react-native', () => ({
  Linking: { openURL: mocks.openURL },
  Platform: mocks.platform,
}));

import { openOAuthUrl } from './openOAuthUrl';

const AUTH_URL = 'https://provider.example/oauth';
const REDIRECT_URL = 'tlon://mcp-oauth/complete';

describe('openOAuthUrl', () => {
  beforeEach(() => {
    mocks.openAuthSessionAsync.mockReset();
    mocks.openURL.mockReset();
    mocks.platform.OS = 'ios';
  });

  it('keeps the external browser on web', async () => {
    mocks.platform.OS = 'web';
    mocks.openURL.mockResolvedValue(undefined);

    await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).resolves.toEqual({
      type: 'opened',
    });
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'])(
    'opens an authentication session directly on %s and returns its redirect',
    async (platform) => {
      mocks.platform.OS = platform;
      mocks.openAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: `${REDIRECT_URL}?status=success`,
      });

      await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).resolves.toEqual({
        type: 'completed',
        url: `${REDIRECT_URL}?status=success`,
      });
      expect(mocks.openAuthSessionAsync).toHaveBeenCalledWith(
        AUTH_URL,
        REDIRECT_URL
      );
      expect(mocks.openURL).not.toHaveBeenCalled();
    }
  );

  it.each(['cancel', 'dismiss'] as const)(
    'returns canceled when the session reports %s',
    async (type) => {
      mocks.openAuthSessionAsync.mockResolvedValue({ type });

      await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).resolves.toEqual({
        type: 'canceled',
      });
    }
  );

  it('surfaces an authentication session failure', async () => {
    const sessionError = new Error('Authentication session unavailable');
    mocks.openAuthSessionAsync.mockRejectedValue(sessionError);

    await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).rejects.toBe(
      sessionError
    );
    expect(mocks.openURL).not.toHaveBeenCalled();
  });

  it('preserves the existing failure on web', async () => {
    const linkingError = new Error('Unable to open URL');
    mocks.platform.OS = 'web';
    mocks.openURL.mockRejectedValue(linkingError);

    await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).rejects.toBe(
      linkingError
    );
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
