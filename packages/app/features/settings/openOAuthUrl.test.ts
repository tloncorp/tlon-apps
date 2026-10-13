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

  it('uses the system browser when it opens successfully', async () => {
    mocks.openURL.mockResolvedValue(undefined);

    await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).resolves.toEqual({
      type: 'opened',
    });
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('falls back to an iOS authentication session and returns its redirect', async () => {
    mocks.openURL.mockRejectedValue(new Error('Unable to open URL'));
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
  });

  it.each(['cancel', 'dismiss'] as const)(
    'returns canceled when the fallback session reports %s',
    async (type) => {
      mocks.openURL.mockRejectedValue(new Error('Unable to open URL'));
      mocks.openAuthSessionAsync.mockResolvedValue({ type });

      await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).resolves.toEqual({
        type: 'canceled',
      });
    }
  );

  it('surfaces a fallback failure', async () => {
    const fallbackError = new Error('Authentication session unavailable');
    mocks.openURL.mockRejectedValue(new Error('Unable to open URL'));
    mocks.openAuthSessionAsync.mockRejectedValue(fallbackError);

    await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).rejects.toBe(
      fallbackError
    );
  });

  it('preserves the existing failure on other platforms', async () => {
    const linkingError = new Error('Unable to open URL');
    mocks.platform.OS = 'android';
    mocks.openURL.mockRejectedValue(linkingError);

    await expect(openOAuthUrl(AUTH_URL, REDIRECT_URL)).rejects.toBe(
      linkingError
    );
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
