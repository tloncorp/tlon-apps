import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getHostingAvailability,
  logInHostingUser,
} from '../client/hostingApi';
import {
  clearHostingSession,
  configureHostingSession,
  getHostingAuthCookie,
  getHostingUserId,
  setHostingSession,
} from '../client/hostingAuthState';

describe('hosting api session behavior', () => {
  beforeEach(() => {
    configureHostingSession({ onSessionChange: null });
    clearHostingSession({ notify: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not send a cookie header when hosting cookie is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, validEmail: true }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getHostingAvailability({});

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers || {}) as Record<string, string>;
    expect(headers.Cookie).toBeUndefined();
  });

  it('strips HttpOnly from manual cookie header in non-browser requests', async () => {
    setHostingSession({ cookie: 'session=abc123; HttpOnly;' }, { notify: false });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, validEmail: true }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getHostingAvailability({});

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers || {}) as Record<string, string>;
    expect(headers.Cookie).toBe('session=abc123');
  });

  it('hydrates in-memory session from login response headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-123' }), {
        status: 200,
        headers: {
          'set-cookie': 'session=xyz; Path=/; HttpOnly',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await logInHostingUser({ email: 'user@tlon.io', password: 'pw' });

    expect(getHostingUserId()).toBe('user-123');
    expect(getHostingAuthCookie()).toBe('session=xyz; Path=/; HttpOnly');
  });
});
