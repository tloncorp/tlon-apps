import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCompactionTimeoutObserver,
  isAgentTimeoutEvent,
  resolveCompactionObservationTimeoutMs,
  resolveDispatchTimeoutMs,
} from './dispatch-timeouts.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('dispatch timeout observation', () => {
  it('resolves the Tlon run timeout', () => {
    expect(
      resolveDispatchTimeoutMs({
        runTimeoutMs: undefined,
        toolTimeoutMs: null,
      })
    ).toBe(900_000);
    expect(
      resolveDispatchTimeoutMs({
        runTimeoutMs: null,
        toolTimeoutMs: null,
      })
    ).toBe(900_000);
    expect(
      resolveDispatchTimeoutMs({
        runTimeoutMs: 999,
        toolTimeoutMs: null,
      })
    ).toBe(900_000);
    expect(
      resolveDispatchTimeoutMs({
        runTimeoutMs: 300_000.9,
        toolTimeoutMs: null,
      })
    ).toBe(300_000);
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
