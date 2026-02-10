import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearHostingSession,
  configureHostingSession,
  getHostingAuthCookie,
  getHostingSession,
  getHostingUserId,
  setHostingSession,
} from '../client/hostingAuthState';

describe('hosting auth state', () => {
  beforeEach(() => {
    configureHostingSession({ onSessionChange: null });
    clearHostingSession({ notify: false });
  });

  it('sets and reads in-memory session synchronously', () => {
    setHostingSession({
      cookie: 'session=abc123',
      userId: 'user-1',
    });

    expect(getHostingAuthCookie()).toBe('session=abc123');
    expect(getHostingUserId()).toBe('user-1');
    expect(getHostingSession()).toEqual({
      cookie: 'session=abc123',
      userId: 'user-1',
    });
  });

  it('applies initial session without firing change hook', async () => {
    const onSessionChange = vi.fn();
    configureHostingSession({
      initialSession: {
        cookie: 'session=init',
        userId: 'user-init',
      },
      onSessionChange,
    });

    expect(getHostingAuthCookie()).toBe('session=init');
    expect(getHostingUserId()).toBe('user-init');
    await Promise.resolve();
    expect(onSessionChange).not.toHaveBeenCalled();
  });

  it('fires change hook when session updates', async () => {
    const onSessionChange = vi.fn(async () => {});
    configureHostingSession({
      onSessionChange,
    });

    setHostingSession({ cookie: 'session=next' });
    await Promise.resolve();

    expect(onSessionChange).toHaveBeenCalledTimes(1);
    expect(onSessionChange).toHaveBeenCalledWith({
      cookie: 'session=next',
      userId: null,
    });
  });
});
