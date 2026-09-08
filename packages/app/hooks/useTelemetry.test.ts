import { describe, expect, it, vi } from 'vitest';

import { captureMandatoryEventWithClient } from './mandatoryTelemetry';

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
