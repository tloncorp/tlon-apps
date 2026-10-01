import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCompactionTimeoutObserver,
  isAgentTimeoutEvent,
  resolveCompactionObservationTimeoutMs,
  resolveDispatchTimeoutMs,
  resolveTimeoutOverrideReplyOptions,
} from './dispatch-timeouts.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('dispatch timeout observation', () => {
  it('resolves an explicit Tlon run timeout', () => {
    expect(
      resolveDispatchTimeoutMs({
        runTimeoutMs: 300_000,
        toolTimeoutMs: null,
      })
    ).toBe(300_000);
    expect(
      resolveDispatchTimeoutMs({ runTimeoutMs: 1_000, toolTimeoutMs: null })
    ).toBe(1_000);
    expect(
      resolveDispatchTimeoutMs({ runTimeoutMs: 1_500.7, toolTimeoutMs: null })
    ).toBe(1_500);
  });

  it('imposes no run timeout when runTimeoutMs is unset', () => {
    expect(
      resolveDispatchTimeoutMs({ runTimeoutMs: null, toolTimeoutMs: null })
    ).toBeUndefined();
  });

  it('ignores invalid run timeouts instead of substituting a default', () => {
    for (const runTimeoutMs of [
      500,
      999,
      0,
      -1,
      -120_000,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(
        resolveDispatchTimeoutMs({ runTimeoutMs, toolTimeoutMs: null })
      ).toBeUndefined();
    }
  });

  it('omits timeoutOverrideSeconds from reply options when unset', () => {
    const options = resolveTimeoutOverrideReplyOptions(
      resolveDispatchTimeoutMs({ runTimeoutMs: null, toolTimeoutMs: null })
    );
    expect(options).toEqual({});
    expect('timeoutOverrideSeconds' in options).toBe(false);
  });

  it('passes the configured run timeout to OpenClaw in whole seconds', () => {
    expect(
      resolveTimeoutOverrideReplyOptions(
        resolveDispatchTimeoutMs({ runTimeoutMs: 900_000, toolTimeoutMs: null })
      )
    ).toEqual({ timeoutOverrideSeconds: 900 });
    expect(resolveTimeoutOverrideReplyOptions(1_500)).toEqual({
      timeoutOverrideSeconds: 2,
    });
  });

  it('reads OpenClaw compaction timeoutSeconds with its deployed default', () => {
    expect(
      resolveCompactionObservationTimeoutMs({
        agents: { defaults: { compaction: { timeoutSeconds: 45 } } },
      })
    ).toBe(45_000);
    expect(resolveCompactionObservationTimeoutMs({})).toBe(180_000);
  });

  it('recognizes only terminal timeout events for the active run', () => {
    const timeoutEvent = {
      runId: 'run-1',
      stream: 'lifecycle',
      data: { phase: 'end', timeoutPhase: 'provider' },
    };
    expect(isAgentTimeoutEvent(timeoutEvent, 'run-1')).toBe(true);
    expect(isAgentTimeoutEvent(timeoutEvent, 'run-2')).toBe(false);
    expect(
      isAgentTimeoutEvent(
        {
          runId: 'run-1',
          stream: 'lifecycle',
          data: { phase: 'end', stopReason: 'timeout' },
        },
        'run-1'
      )
    ).toBe(true);
    expect(
      isAgentTimeoutEvent(
        {
          runId: 'run-1',
          stream: 'lifecycle',
          data: { phase: 'end', aborted: true },
        },
        'run-1'
      )
    ).toBe(false);
  });

  it('observes an unfinished compaction without aborting it', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const observer = createCompactionTimeoutObserver({
      timeoutMs: 180_000,
      onTimeout,
    });

    observer.start();
    vi.advanceTimersByTime(179_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('cancels observation when compaction completes', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const observer = createCompactionTimeoutObserver({
      timeoutMs: 180_000,
      onTimeout,
    });

    observer.start();
    observer.complete();
    vi.advanceTimersByTime(180_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
