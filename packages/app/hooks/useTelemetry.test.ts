import { describe, expect, it, vi } from 'vitest';

import { captureMandatoryEventWithClient } from './mandatoryTelemetry';
import { ensureIdentified } from './sessionIdentity';

function client() {
  return {
    optIn: vi.fn(),
    optOut: vi.fn(),
    capture: vi.fn(),
    flush: vi.fn((): Promise<void> => Promise.resolve()),
  };
}

describe('captureMandatoryEventWithClient', () => {
  it('restores opt-out when flushing fails', async () => {
    const posthog = client();
    posthog.flush.mockRejectedValueOnce(new Error('flush failed'));

    await expect(
      captureMandatoryEventWithClient({
        posthog,
        getIsOptedOut: () => true,
        eventId: 'feedback',
      })
    ).rejects.toThrow('flush failed');

    expect(posthog.optIn).toHaveBeenCalledOnce();
    expect(posthog.optOut).toHaveBeenCalledOnce();
  });

  it('serializes mandatory captures around the global opt state', async () => {
    const posthog = client();
    let releaseFirstFlush!: () => void;
    posthog.flush
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (releaseFirstFlush = resolve))
      )
      .mockResolvedValueOnce(undefined);

    const first = captureMandatoryEventWithClient({
      posthog,
      getIsOptedOut: () => true,
      eventId: 'first',
    });
    const second = captureMandatoryEventWithClient({
      posthog,
      getIsOptedOut: () => true,
      eventId: 'second',
    });

    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    releaseFirstFlush();
    await Promise.all([first, second]);

    expect(posthog.capture.mock.calls.map(([event]) => event)).toEqual([
      'first',
      'second',
    ]);
    expect(posthog.optIn).toHaveBeenCalledTimes(2);
    expect(posthog.optOut).toHaveBeenCalledTimes(2);
  });
});

describe('ensureIdentified', () => {
  function identityClient(distinctId: string | undefined) {
    return {
      identify: vi.fn(),
      distinctId: vi.fn(() => distinctId),
    };
  }

  it('identifies when the sdk id has drifted from the ship', () => {
    const posthog = identityClient('01924f3a-anon');

    expect(
      ensureIdentified({
        posthog,
        userId: '~sampel-palnet',
        isHosted: true,
      })
    ).toBe(true);

    expect(posthog.identify).toHaveBeenCalledOnce();
    expect(posthog.identify).toHaveBeenCalledWith('~sampel-palnet', {
      isHostedUser: true,
      userId: '~sampel-palnet',
    });
  });

  it('is a no-op when the sdk already reports the ship', () => {
    const posthog = identityClient('~sampel-palnet');

    expect(
      ensureIdentified({
        posthog,
        userId: '~sampel-palnet',
        isHosted: true,
      })
    ).toBe(false);

    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('does not identify without a ship', () => {
    const posthog = identityClient('01924f3a-anon');

    expect(ensureIdentified({ posthog, userId: '', isHosted: false })).toBe(
      false
    );

    expect(posthog.identify).not.toHaveBeenCalled();
  });
});
